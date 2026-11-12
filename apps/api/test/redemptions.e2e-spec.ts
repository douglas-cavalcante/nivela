import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import { createClassroom, createReward } from './helpers/factories';
import { sessionFor } from './helpers/login';
import { resetDatabase } from './helpers/reset-database';

const FINISHED = { message: 'Este resgate já foi finalizado.' };
const REDEMPTION_NOT_FOUND = { message: 'Resgate não encontrado.' };

describe('Resgates (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Aluno com saldo (e a linha correspondente no extrato), já com sessão aberta. */
  async function student(balance: number) {
    const session = await sessionFor(app, Role.Student);
    await prisma.studentProfile.update({
      where: { userId: session.user.id },
      data: { coinsBalance: balance },
    });
    if (balance > 0) {
      await prisma.coinTransaction.create({
        data: {
          studentId: session.user.id,
          amount: balance,
          reason: 'correct_answer',
          sourceType: 'question',
          sourceId: session.user.id,
        },
      });
    }
    return session;
  }

  /** Professor com turma e um aluno matriculado. */
  async function teacherWithStudent(balance = 100) {
    const teacher = await sessionFor(app, Role.Teacher);
    const classroom = await createClassroom(prisma, {
      teacherId: teacher.user.id,
    });
    const pupil = await student(balance);
    await prisma.classroomStudent.create({
      data: { classroomId: classroom.id, studentId: pupil.user.id },
    });
    return { teacher, classroom, pupil };
  }

  const redeem = (token: string, rewardId: number) =>
    http().post(`/api/v1/store/rewards/${rewardId}/redeem`).set(as(token));

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

  describe('resgate pelo aluno', () => {
    it('desconta o preço, baixa o estoque, grava o extrato e congela o preço pago', async () => {
      const reward = await createReward(prisma, { price: 30, stock: 2 });
      const { user, token } = await student(100);

      const res = await redeem(token, reward.id).expect(201);
      expect(res.body).toEqual({
        redemption: {
          id: expect.any(Number) as number,
          reward: { id: reward.id, name: reward.name, image_url: null },
          price_paid: 30,
          status: 'pending',
          rejection_reason: null,
          created_at: expect.any(String) as string,
          handled_at: null,
        },
        coins_balance: 70,
        stock: 1,
      });

      const profile = await prisma.studentProfile.findUniqueOrThrow({
        where: { userId: user.id },
      });
      expect(profile.coinsBalance).toBe(70);
      const ledger = await prisma.coinTransaction.findMany({
        where: { studentId: user.id, reason: 'redemption' },
      });
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({
        amount: -30,
        sourceType: 'redemption',
        sourceId: res.body.redemption.id as number,
      });

      // Reajustar o preço depois não altera o que o aluno pagou.
      await prisma.reward.update({
        where: { id: reward.id },
        data: { price: 99 },
      });
      const mine = await http()
        .get('/api/v1/store/redemptions')
        .set(as(token))
        .expect(200);
      expect(mine.body.data[0].price_paid).toBe(30);
    });

    it('saldo igual ao preço basta e zera o saldo', async () => {
      const reward = await createReward(prisma, { price: 40, stock: 1 });
      const { token } = await student(40);
      const res = await redeem(token, reward.id).expect(201);
      expect(res.body.coins_balance).toBe(0);
      expect(res.body.stock).toBe(0);
    });

    it('esgotado: 409 "Prêmio esgotado." sem mexer no saldo', async () => {
      const reward = await createReward(prisma, { price: 10, stock: 0 });
      const { user, token } = await student(100);
      const res = await redeem(token, reward.id).expect(409);
      expect(res.body.message).toBe('Prêmio esgotado.');
      const profile = await prisma.studentProfile.findUniqueOrThrow({
        where: { userId: user.id },
      });
      expect(profile.coinsBalance).toBe(100);
      expect(await prisma.rewardRedemption.count()).toBe(0);
    });

    it('saldo insuficiente: 409 "Saldo insuficiente." sem baixar o estoque', async () => {
      const reward = await createReward(prisma, { price: 50, stock: 3 });
      const { token } = await student(49);
      const res = await redeem(token, reward.id).expect(409);
      expect(res.body.message).toBe('Saldo insuficiente.');
      const after = await prisma.reward.findUniqueOrThrow({
        where: { id: reward.id },
      });
      expect(after.stock).toBe(3);
      expect(await prisma.rewardRedemption.count()).toBe(0);
    });

    it('prêmio inativo ou inexistente: 404 "Prêmio não encontrado."', async () => {
      const inactive = await createReward(prisma, { active: false });
      const { token } = await student(100);
      for (const id of [inactive.id, 99999, 0]) {
        const res = await redeem(token, id).expect(404);
        expect(res.body.message).toBe('Prêmio não encontrado.');
      }
    });

    it('equipe leva 403 nas rotas do aluno; sem token, 401', async () => {
      const reward = await createReward(prisma);
      const teacher = await sessionFor(app, Role.Teacher);
      const admin = await sessionFor(app, Role.Admin);
      for (const { token } of [teacher, admin]) {
        await redeem(token, reward.id).expect(403);
        await http()
          .get('/api/v1/store/redemptions')
          .set(as(token))
          .expect(403);
      }
      await http()
        .post(`/api/v1/store/rewards/${reward.id}/redeem`)
        .expect(401);
    });

    it('lista só os resgates do próprio aluno, do mais recente ao mais antigo, com filtro de situação', async () => {
      const reward = await createReward(prisma, { price: 5, stock: 10 });
      const me = await student(100);
      const other = await student(100);
      const first = await redeem(me.token, reward.id).expect(201);
      const second = await redeem(me.token, reward.id).expect(201);
      await redeem(other.token, reward.id).expect(201);
      await prisma.rewardRedemption.update({
        where: { id: first.body.redemption.id as number },
        data: { status: 'delivered', handledAt: new Date() },
      });

      const all = await http()
        .get('/api/v1/store/redemptions')
        .set(as(me.token))
        .expect(200);
      expect(
        (all.body.data as Array<{ id: number }>).map(({ id }) => id),
      ).toEqual([second.body.redemption.id, first.body.redemption.id]);
      expect(all.body.meta.total).toBe(2);

      const delivered = await http()
        .get('/api/v1/store/redemptions?status=delivered&per_page=1')
        .set(as(me.token))
        .expect(200);
      expect(delivered.body.data).toHaveLength(1);
      expect(delivered.body.data[0].status).toBe('delivered');

      await http()
        .get('/api/v1/store/redemptions?status=xyz')
        .set(as(me.token))
        .expect(422);
    });
  });

  describe('fila da equipe', () => {
    it('lista pendentes por padrão, mais antigos primeiro, com aluno e turmas; só o escopo do professor', async () => {
      const reward = await createReward(prisma, { price: 5, stock: 10 });
      const a = await teacherWithStudent();
      const b = await teacherWithStudent();
      const r1 = await redeem(a.pupil.token, reward.id).expect(201);
      const r2 = await redeem(a.pupil.token, reward.id).expect(201);
      await redeem(b.pupil.token, reward.id).expect(201);
      await prisma.rewardRedemption.update({
        where: { id: r2.body.redemption.id as number },
        data: { status: 'delivered', handledAt: new Date() },
      });

      const res = await http()
        .get('/api/v1/redemptions')
        .set(as(a.teacher.token))
        .expect(200);
      expect(res.body.data).toEqual([
        {
          ...r1.body.redemption,
          student: {
            id: a.pupil.user.id,
            name: a.pupil.user.name,
            classrooms: [{ id: a.classroom.id, name: a.classroom.name }],
          },
          handled_by: null,
        },
      ]);

      const done = await http()
        .get('/api/v1/redemptions?status=delivered')
        .set(as(a.teacher.token))
        .expect(200);
      expect(done.body.data).toHaveLength(1);

      const admin = await sessionFor(app, Role.Admin);
      const all = await http()
        .get('/api/v1/redemptions')
        .set(as(admin.token))
        .expect(200);
      expect(all.body.meta.total).toBe(2);
    });

    it('fila pendente em ordem de chegada (mais antigo primeiro)', async () => {
      const reward = await createReward(prisma, { price: 5, stock: 10 });
      const { teacher, pupil } = await teacherWithStudent();
      const r1 = await redeem(pupil.token, reward.id).expect(201);
      const r2 = await redeem(pupil.token, reward.id).expect(201);
      const res = await http()
        .get('/api/v1/redemptions')
        .set(as(teacher.token))
        .expect(200);
      expect(
        (res.body.data as Array<{ id: number }>).map(({ id }) => id),
      ).toEqual([r1.body.redemption.id, r2.body.redemption.id]);
    });

    it('filtra por turma e busca pelo nome do aluno sem diferenciar maiúsculas', async () => {
      const reward = await createReward(prisma, { price: 5, stock: 10 });
      const teacher = await sessionFor(app, Role.Teacher);
      const c1 = await createClassroom(prisma, { teacherId: teacher.user.id });
      const c2 = await createClassroom(prisma, { teacherId: teacher.user.id });
      const ana = await student(50);
      const bia = await student(50);
      await prisma.user.update({
        where: { id: ana.user.id },
        data: { name: 'Ana Paula' },
      });
      await prisma.user.update({
        where: { id: bia.user.id },
        data: { name: 'Bia Souza' },
      });
      await prisma.classroomStudent.create({
        data: { classroomId: c1.id, studentId: ana.user.id },
      });
      await prisma.classroomStudent.create({
        data: { classroomId: c2.id, studentId: bia.user.id },
      });
      await redeem(ana.token, reward.id).expect(201);
      await redeem(bia.token, reward.id).expect(201);

      const byClass = await http()
        .get(`/api/v1/redemptions?classroom_id=${c2.id}`)
        .set(as(teacher.token))
        .expect(200);
      expect(
        (byClass.body.data as Array<{ student: { name: string } }>).map(
          (row) => row.student.name,
        ),
      ).toEqual(['Bia Souza']);

      const bySearch = await http()
        .get('/api/v1/redemptions?search=aNa%20pau')
        .set(as(teacher.token))
        .expect(200);
      expect(bySearch.body.meta.total).toBe(1);
      expect(bySearch.body.data[0].student.name).toBe('Ana Paula');

      const foreign = await createClassroom(prisma);
      const none = await http()
        .get(`/api/v1/redemptions?classroom_id=${foreign.id}`)
        .set(as(teacher.token))
        .expect(200);
      expect(none.body.data).toEqual([]);
      await http()
        .get('/api/v1/redemptions?status=xyz')
        .set(as(teacher.token))
        .expect(422);
    });

    it('aluno leva 403 nas rotas da equipe; sem token, 401', async () => {
      const { token } = await student(0);
      await http().get('/api/v1/redemptions').set(as(token)).expect(403);
      await http()
        .post('/api/v1/redemptions/1/deliver')
        .set(as(token))
        .expect(403);
      await http()
        .post('/api/v1/redemptions/1/reject')
        .set(as(token))
        .send({ reason: 'Sem estoque.' })
        .expect(403);
      await http().get('/api/v1/redemptions').expect(401);
    });

    it('entregar marca como entregue com quem tratou e quando; de novo, 409', async () => {
      const reward = await createReward(prisma, { price: 5 });
      const { teacher, pupil } = await teacherWithStudent();
      const r = await redeem(pupil.token, reward.id).expect(201);
      const id = r.body.redemption.id as number;

      const res = await http()
        .post(`/api/v1/redemptions/${id}/deliver`)
        .set(as(teacher.token))
        .expect(200);
      expect(res.body).toMatchObject({
        id,
        status: 'delivered',
        handled_by: { id: teacher.user.id, name: teacher.user.name },
        handled_at: expect.any(String) as string,
        rejection_reason: null,
      });

      const again = await http()
        .post(`/api/v1/redemptions/${id}/deliver`)
        .set(as(teacher.token))
        .expect(409);
      expect(again.body).toMatchObject(FINISHED);
      await http()
        .post(`/api/v1/redemptions/${id}/reject`)
        .set(as(teacher.token))
        .send({ reason: 'Tarde demais.' })
        .expect(409);
      expect(
        await prisma.coinTransaction.count({ where: { reason: 'refund' } }),
      ).toBe(0);
    });

    it('recusar devolve as moedas (extrato) e o estoque, guarda o motivo e finaliza', async () => {
      const reward = await createReward(prisma, { price: 30, stock: 2 });
      const { teacher, pupil } = await teacherWithStudent(100);
      const r = await redeem(pupil.token, reward.id).expect(201);
      const id = r.body.redemption.id as number;
      // O preço mudou depois: o estorno devolve o que foi pago.
      await prisma.reward.update({
        where: { id: reward.id },
        data: { price: 99 },
      });

      const res = await http()
        .post(`/api/v1/redemptions/${id}/reject`)
        .set(as(teacher.token))
        .send({ reason: '  Item indisponível.  ' })
        .expect(200);
      expect(res.body).toMatchObject({
        id,
        status: 'rejected',
        rejection_reason: 'Item indisponível.',
        handled_by: { id: teacher.user.id },
        handled_at: expect.any(String) as string,
      });

      const profile = await prisma.studentProfile.findUniqueOrThrow({
        where: { userId: pupil.user.id },
      });
      expect(profile.coinsBalance).toBe(100);
      const refunds = await prisma.coinTransaction.findMany({
        where: { studentId: pupil.user.id, reason: 'refund' },
      });
      expect(refunds).toHaveLength(1);
      expect(refunds[0]).toMatchObject({
        amount: 30,
        sourceType: 'redemption',
        sourceId: id,
      });
      expect(
        (await prisma.reward.findUniqueOrThrow({ where: { id: reward.id } }))
          .stock,
      ).toBe(2);

      const again = await http()
        .post(`/api/v1/redemptions/${id}/reject`)
        .set(as(teacher.token))
        .send({ reason: 'De novo.' })
        .expect(409);
      expect(again.body).toMatchObject(FINISHED);
      await http()
        .post(`/api/v1/redemptions/${id}/deliver`)
        .set(as(teacher.token))
        .expect(409);

      const mine = await http()
        .get('/api/v1/store/redemptions')
        .set(as(pupil.token))
        .expect(200);
      expect(mine.body.data[0]).toMatchObject({
        status: 'rejected',
        rejection_reason: 'Item indisponível.',
      });
    });

    it('recusar sem motivo, curto ou longo demais: 422 e nada muda', async () => {
      const reward = await createReward(prisma, { price: 5 });
      const { teacher, pupil } = await teacherWithStudent();
      const r = await redeem(pupil.token, reward.id).expect(201);
      const id = r.body.redemption.id as number;
      const bodies: Array<Record<string, unknown>> = [
        {},
        { reason: '' },
        { reason: '  ' },
        { reason: 'ab' },
        { reason: 'x'.repeat(301) },
        { reason: 7 },
      ];
      for (const payload of bodies) {
        await http()
          .post(`/api/v1/redemptions/${id}/reject`)
          .set(as(teacher.token))
          .send(payload)
          .expect(422);
      }
      const pending = await prisma.rewardRedemption.findUniqueOrThrow({
        where: { id },
      });
      expect(pending.status).toBe('pending');
      await http()
        .post(`/api/v1/redemptions/${id}/reject`)
        .set(as(teacher.token))
        .send({ reason: 'x'.repeat(300) })
        .expect(200);
    });

    it('professor fora do escopo: 404 "Resgate não encontrado." em deliver e reject, sem efeito', async () => {
      const reward = await createReward(prisma, { price: 5 });
      const a = await teacherWithStudent();
      const b = await teacherWithStudent();
      const r = await redeem(a.pupil.token, reward.id).expect(201);
      const id = r.body.redemption.id as number;

      const deliver = await http()
        .post(`/api/v1/redemptions/${id}/deliver`)
        .set(as(b.teacher.token))
        .expect(404);
      expect(deliver.body).toMatchObject(REDEMPTION_NOT_FOUND);
      const reject = await http()
        .post(`/api/v1/redemptions/${id}/reject`)
        .set(as(b.teacher.token))
        .send({ reason: 'Não é meu aluno.' })
        .expect(404);
      expect(reject.body).toMatchObject(REDEMPTION_NOT_FOUND);
      await http()
        .post('/api/v1/redemptions/99999/deliver')
        .set(as(b.teacher.token))
        .expect(404);
      await http()
        .post('/api/v1/redemptions/abc/deliver')
        .set(as(b.teacher.token))
        .expect(404);

      const row = await prisma.rewardRedemption.findUniqueOrThrow({
        where: { id },
      });
      expect(row.status).toBe('pending');
      expect(
        await prisma.coinTransaction.count({ where: { reason: 'refund' } }),
      ).toBe(0);

      // O administrador trata qualquer resgate.
      const admin = await sessionFor(app, Role.Admin);
      await http()
        .post(`/api/v1/redemptions/${id}/deliver`)
        .set(as(admin.token))
        .expect(200);
    });

    it('aluno sem turma só aparece para o administrador', async () => {
      const reward = await createReward(prisma, { price: 5 });
      const loose = await student(50);
      await redeem(loose.token, reward.id).expect(201);
      const teacher = await sessionFor(app, Role.Teacher);
      const admin = await sessionFor(app, Role.Admin);
      const forTeacher = await http()
        .get('/api/v1/redemptions')
        .set(as(teacher.token))
        .expect(200);
      expect(forTeacher.body.meta.total).toBe(0);
      const res = await http()
        .get('/api/v1/redemptions')
        .set(as(admin.token))
        .expect(200);
      expect(res.body.data[0].student.classrooms).toEqual([]);
    });
  });
});
