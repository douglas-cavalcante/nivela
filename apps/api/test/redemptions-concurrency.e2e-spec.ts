import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import { createClassroom, createReward } from './helpers/factories';
import { sessionFor } from './helpers/login';
import { resetDatabase } from './helpers/reset-database';

/**
 * Corridas determinísticas: uma transação "segurador" trava a linha que as
 * requisições disputam; as requisições são disparadas juntas, o teste espera
 * (em `pg_stat_activity`) todas estarem bloqueadas em `FOR UPDATE` e só então
 * solta o segurador. Assim as requisições realmente chegam ao mesmo tempo ao
 * banco, em vez de duas chamadas em sequência.
 */
describe('Resgates concorrentes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function waitUntil(check: () => Promise<boolean>, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;
    while (!(await check())) {
      if (Date.now() > deadline) {
        throw new Error('Condição não ocorreu a tempo.');
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  async function waitForLockWaiters(count: number) {
    await waitUntil(async () => {
      const rows = await prisma.$queryRaw<{ waiting: number }[]>`
        SELECT count(*)::int AS waiting FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND wait_event_type = 'Lock'
          AND query LIKE '%FOR UPDATE%'`;
      return rows[0].waiting >= count;
    });
  }

  /**
   * Segura `lockSql` (um `SELECT ... FOR UPDATE`) numa transação aberta,
   * dispara as requisições, espera `waiters` delas bloqueadas e solta.
   */
  async function raceBehindLock(
    lockSql: string,
    waiters: number,
    fire: () => request.Test[],
  ): Promise<request.Response[]> {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held!: () => void;
    const locked = new Promise<void>((resolve) => {
      held = resolve;
    });
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRawUnsafe(lockSql);
        held();
        await barrier;
      },
      { timeout: 30_000 },
    );
    await locked;
    const pending = fire().map((req) => req.then((res) => res));
    try {
      await waitForLockWaiters(waiters);
    } finally {
      // Sem isto, uma falha da espera deixaria o segurador travando para sempre.
      release();
    }
    await holder;
    return Promise.all(pending);
  }

  const lockProfile = (studentId: number) =>
    `SELECT 1 FROM "student_profiles" WHERE "user_id" = ${studentId} FOR UPDATE`;
  const lockReward = (rewardId: number) =>
    `SELECT 1 FROM "rewards" WHERE "id" = ${rewardId} FOR UPDATE`;
  const lockRedemption = (id: number) =>
    `SELECT 1 FROM "reward_redemptions" WHERE "id" = ${id} FOR UPDATE`;

  const redeem = (token: string, rewardId: number) =>
    http().post(`/api/v1/store/rewards/${rewardId}/redeem`).set(as(token));

  /** Aluno com saldo e a linha correspondente no extrato. */
  async function student(balance: number) {
    const session = await sessionFor(app, Role.Student);
    await prisma.studentProfile.update({
      where: { userId: session.user.id },
      data: { coinsBalance: balance },
    });
    await prisma.coinTransaction.create({
      data: {
        studentId: session.user.id,
        amount: balance,
        reason: 'correct_answer',
        sourceType: 'question',
        sourceId: session.user.id,
      },
    });
    return session;
  }

  /** Saldo do perfil, soma do extrato e o estoque do prêmio. */
  async function snapshot(studentId: number, rewardId: number) {
    const profile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: studentId },
    });
    const sum = await prisma.coinTransaction.aggregate({
      where: { studentId },
      _sum: { amount: true },
    });
    const reward = await prisma.reward.findUniqueOrThrow({
      where: { id: rewardId },
    });
    return {
      balance: profile.coinsBalance,
      ledger: sum._sum.amount ?? 0,
      stock: reward.stock,
    };
  }

  const statuses = (responses: request.Response[]) =>
    responses.map((res) => res.status).sort();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  describe('Foco 1: saldo para um só resgate', () => {
    it('dois resgates simultâneos do mesmo aluno: um 201, outro 409 "Saldo insuficiente."', async () => {
      const reward = await createReward(prisma, { price: 50, stock: 5 });
      const { user, token } = await student(50);

      const responses = await raceBehindLock(lockProfile(user.id), 2, () => [
        redeem(token, reward.id),
        redeem(token, reward.id),
      ]);

      expect(statuses(responses)).toEqual([201, 409]);
      const loser = responses.find((res) => res.status === 409);
      expect(loser?.body.message).toBe('Saldo insuficiente.');
      const after = await snapshot(user.id, reward.id);
      expect(after).toEqual({ balance: 0, ledger: 0, stock: 4 });
      expect(
        await prisma.rewardRedemption.count({ where: { studentId: user.id } }),
      ).toBe(1);
      expect(
        await prisma.coinTransaction.count({
          where: { studentId: user.id, reason: 'redemption' },
        }),
      ).toBe(1);
    });

    it('cinco simultâneos com saldo para dois: exatamente dois 201, saldo nunca negativo', async () => {
      const reward = await createReward(prisma, { price: 50, stock: 10 });
      const { user, token } = await student(100);

      const responses = await raceBehindLock(lockProfile(user.id), 5, () =>
        Array.from({ length: 5 }, () => redeem(token, reward.id)),
      );

      expect(statuses(responses)).toEqual([201, 201, 409, 409, 409]);
      const after = await snapshot(user.id, reward.id);
      expect(after).toEqual({ balance: 0, ledger: 0, stock: 8 });
    });
  });

  describe('Foco 2: última unidade disputada por dois alunos', () => {
    it('um 201 e um 409 "Prêmio esgotado."; estoque nunca negativo', async () => {
      const reward = await createReward(prisma, { price: 20, stock: 1 });
      const a = await student(100);
      const b = await student(100);

      const responses = await raceBehindLock(lockReward(reward.id), 2, () => [
        redeem(a.token, reward.id),
        redeem(b.token, reward.id),
      ]);

      expect(statuses(responses)).toEqual([201, 409]);
      const loser = responses.find((res) => res.status === 409);
      expect(loser?.body.message).toBe('Prêmio esgotado.');
      const rows = await prisma.rewardRedemption.findMany();
      expect(rows).toHaveLength(1);
      const winnerId = rows[0].studentId;
      const loserId = winnerId === a.user.id ? b.user.id : a.user.id;
      expect(await snapshot(winnerId, reward.id)).toEqual({
        balance: 80,
        ledger: 80,
        stock: 0,
      });
      expect(await snapshot(loserId, reward.id)).toMatchObject({
        balance: 100,
        ledger: 100,
      });
    });

    it('editar o prêmio (PUT com estoque absoluto) concorre com um resgate: as escritas se serializam, mas o PUT grava o valor do formulário', async () => {
      const reward = await createReward(prisma, { price: 20, stock: 3 });
      const { token } = await student(100);
      const admin = await sessionFor(app, Role.Admin);

      // O PUT também espera pelo `FOR UPDATE` do prêmio: sem ele, só um
      // bloqueado seria visto aqui e a espera estouraria.
      const responses = await raceBehindLock(lockReward(reward.id), 2, () => [
        redeem(token, reward.id),
        http()
          .put(`/api/v1/rewards/${reward.id}`)
          .set(as(admin.token))
          .send({ name: 'Editado', price: 20, stock: 10 }),
      ]);

      expect(statuses(responses)).toEqual([200, 201]);
      const after = await prisma.reward.findUniqueOrThrow({
        where: { id: reward.id },
      });
      // PUT depois do resgate: 10 (o absoluto do formulário sobrescreve a
      // baixa); resgate depois do PUT: 9. Sem `stock` no PUT, a baixa fica.
      expect([9, 10]).toContain(after.stock);
      expect(await prisma.rewardRedemption.count()).toBe(1);
    });
  });

  describe('Foco 3: entregar e recusar ao mesmo tempo', () => {
    /** Aluno do professor, com um resgate pendente de 30 moedas. */
    async function pendingRedemption() {
      const reward = await createReward(prisma, { price: 30, stock: 2 });
      const teacher = await sessionFor(app, Role.Teacher);
      const admin = await sessionFor(app, Role.Admin);
      const classroom = await createClassroom(prisma, {
        teacherId: teacher.user.id,
      });
      const pupil = await student(100);
      await prisma.classroomStudent.create({
        data: { classroomId: classroom.id, studentId: pupil.user.id },
      });
      const created = await redeem(pupil.token, reward.id).expect(201);
      return {
        reward,
        teacher,
        admin,
        pupil,
        id: created.body.redemption.id as number,
      };
    }

    const deliver = (token: string, id: number) =>
      http().post(`/api/v1/redemptions/${id}/deliver`).set(as(token));
    const reject = (token: string, id: number) =>
      http()
        .post(`/api/v1/redemptions/${id}/reject`)
        .set(as(token))
        .send({ reason: 'Sem estoque.' });

    async function expectConsistentEnd(
      setup: Awaited<ReturnType<typeof pendingRedemption>>,
    ) {
      const row = await prisma.rewardRedemption.findUniqueOrThrow({
        where: { id: setup.id },
      });
      const refunds = await prisma.coinTransaction.count({
        where: { studentId: setup.pupil.user.id, reason: 'refund' },
      });
      const after = await snapshot(setup.pupil.user.id, setup.reward.id);
      expect(after.balance).toBe(after.ledger);
      expect(row.handledBy).not.toBeNull();
      if (row.status === 'rejected') {
        expect(refunds).toBe(1);
        expect(after).toEqual({ balance: 100, ledger: 100, stock: 2 });
      } else {
        expect(row.status).toBe('delivered');
        expect(refunds).toBe(0);
        expect(after).toEqual({ balance: 70, ledger: 70, stock: 1 });
      }
    }

    it('entregar x recusar: um 200 e um 409 "Este resgate já foi finalizado."; um único estado final', async () => {
      const setup = await pendingRedemption();
      const responses = await raceBehindLock(
        lockRedemption(setup.id),
        2,
        () => [
          deliver(setup.teacher.token, setup.id),
          reject(setup.admin.token, setup.id),
        ],
      );
      expect(statuses(responses)).toEqual([200, 409]);
      expect(responses.find((res) => res.status === 409)?.body.message).toBe(
        'Este resgate já foi finalizado.',
      );
      await expectConsistentEnd(setup);
    });

    it('recusar duas vezes: estorno e devolução de estoque uma única vez', async () => {
      const setup = await pendingRedemption();
      const responses = await raceBehindLock(
        lockRedemption(setup.id),
        2,
        () => [
          reject(setup.teacher.token, setup.id),
          reject(setup.admin.token, setup.id),
        ],
      );
      expect(statuses(responses)).toEqual([200, 409]);
      expect(responses.find((res) => res.status === 409)?.body.message).toBe(
        'Este resgate já foi finalizado.',
      );
      const row = await prisma.rewardRedemption.findUniqueOrThrow({
        where: { id: setup.id },
      });
      expect(row.status).toBe('rejected');
      await expectConsistentEnd(setup);
    });

    it('entregar duas vezes: um 200 e um 409', async () => {
      const setup = await pendingRedemption();
      const responses = await raceBehindLock(
        lockRedemption(setup.id),
        2,
        () => [
          deliver(setup.teacher.token, setup.id),
          deliver(setup.admin.token, setup.id),
        ],
      );
      expect(statuses(responses)).toEqual([200, 409]);
      await expectConsistentEnd(setup);
    });

    it('recusar x novo resgate do mesmo aluno: sem deadlock, saldo = extrato', async () => {
      const setup = await pendingRedemption();
      // Os dois chegam ao perfil do aluno ao mesmo tempo: o resgate novo
      // (perfil -> prêmio) e a recusa (perfil -> resgate -> prêmio) seguem a
      // mesma ordem de travas, então só esperam um pelo outro.
      const responses = await raceBehindLock(
        lockProfile(setup.pupil.user.id),
        2,
        () => [
          redeem(setup.pupil.token, setup.reward.id),
          reject(setup.teacher.token, setup.id),
        ],
      );
      expect(statuses(responses)).toEqual([200, 201]);
      const after = await snapshot(setup.pupil.user.id, setup.reward.id);
      expect(after).toEqual({ balance: 70, ledger: 70, stock: 1 });
    });
  });
});
