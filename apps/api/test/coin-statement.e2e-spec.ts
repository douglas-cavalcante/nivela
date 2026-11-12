import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { dayNumber } from 'src/shared/study/study-day';
import { createTestApp } from './helpers/create-test-app';
import {
  createClassroom,
  createQuestion,
  createReward,
} from './helpers/factories';
import { sessionFor } from './helpers/login';
import { createPlan } from './helpers/plans';
import { resetDatabase } from './helpers/reset-database';

describe('Extrato de moedas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const get = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(`/api/v1${path}`)
      .set({ Authorization: `Bearer ${token}` });

  /** Aluno com um lançamento de cada tipo, em instantes crescentes. */
  async function studentWithStatement() {
    const pupil = await sessionFor(app, Role.Student);
    const teacher = await sessionFor(app, Role.Teacher);
    const question = await createQuestion(prisma, {
      statement: 'Quanto é 1/2 + 1/4?',
    });
    const reward = await createReward(prisma, { name: 'Caderno' });
    const { planId } = await createPlan(prisma, {
      teacherId: teacher.user.id,
      subjectId: question.subjectId,
      title: 'Plano de frações',
      chapters: [1],
    });
    const redemption = await prisma.rewardRedemption.create({
      data: { rewardId: reward.id, studentId: pupil.user.id, pricePaid: 30 },
    });
    const rows = [
      ['correct_answer', 10, 'question', question.id],
      ['plan_completed', 50, 'plan', planId],
      ['streak_bonus', 20, 'study_day', dayNumber('2026-11-07')],
      ['redemption', -30, 'redemption', redemption.id],
      ['refund', 30, 'redemption', redemption.id],
    ] as const;
    let minute = 0;
    for (const [reason, amount, sourceType, sourceId] of rows) {
      minute += 1;
      await prisma.coinTransaction.create({
        data: {
          studentId: pupil.user.id,
          reason,
          amount,
          sourceType,
          sourceId,
          createdAt: new Date(Date.UTC(2026, 10, 9, 12, minute)),
        },
      });
    }
    return { pupil, teacher };
  }

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

  it('exige autenticação e o perfil certo em cada rota', async () => {
    const student = await sessionFor(app, Role.Student);
    const teacher = await sessionFor(app, Role.Teacher);
    await request(app.getHttpServer()).get('/api/v1/me/coins').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/students/1/coins')
      .expect(401);
    await get('/students/1/coins', student.token).expect(403);
    await get('/me/coins', teacher.token).expect(403);
  });

  it('o aluno vê o extrato com as cinco descrições, do mais recente ao mais antigo', async () => {
    const { pupil } = await studentWithStatement();
    const { body } = await get('/me/coins', pupil.token).expect(200);

    expect(body.meta).toEqual({
      page: 1,
      per_page: 15,
      total: 5,
      last_page: 1,
    });
    expect(
      body.data.map(
        (t: { reason: string; amount: number; description: string }) => [
          t.reason,
          t.amount,
          t.description,
        ],
      ),
    ).toEqual([
      ['refund', 30, 'Estorno: Caderno.'],
      ['redemption', -30, 'Resgate: Caderno.'],
      ['streak_bonus', 20, 'Sequência de 7 dias (até 07/11/2026).'],
      ['plan_completed', 50, 'Plano concluído: Plano de frações.'],
      ['correct_answer', 10, 'Acerto: Quanto é 1/2 + 1/4?.'],
    ]);
    expect(body.data[0]).toEqual({
      id: expect.any(Number),
      amount: 30,
      reason: 'refund',
      description: 'Estorno: Caderno.',
      created_at: '2026-11-09T12:05:00.000Z',
    });
  });

  it('ordena só pelo id: movimento mais novo (id maior) vem primeiro mesmo com horário menor', async () => {
    const { pupil } = await studentWithStatement();
    const late = await prisma.coinTransaction.create({
      data: {
        studentId: pupil.user.id,
        reason: 'plan_completed',
        amount: 1,
        sourceType: 'plan',
        sourceId: 999,
        createdAt: new Date(Date.UTC(2026, 10, 1, 8, 0)),
      },
    });
    const { body } = await get('/me/coins', pupil.token).expect(200);
    expect(body.data[0].id).toBe(late.id);
    expect(body.data[0].created_at).toBe('2026-11-01T08:00:00.000Z');
  });

  it('pagina o extrato', async () => {
    const { pupil } = await studentWithStatement();
    const second = await get('/me/coins?page=2&per_page=2', pupil.token).expect(
      200,
    );
    expect(second.body.meta).toEqual({
      page: 2,
      per_page: 2,
      total: 5,
      last_page: 3,
    });
    expect(second.body.data.map((t: { reason: string }) => t.reason)).toEqual([
      'streak_bonus',
      'plan_completed',
    ]);
  });

  it('o aluno vê só o próprio extrato', async () => {
    await studentWithStatement();
    const other = await sessionFor(app, Role.Student);
    const { body } = await get('/me/coins', other.token).expect(200);
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it('corta o enunciado longo na descrição do acerto', async () => {
    const pupil = await sessionFor(app, Role.Student);
    const question = await createQuestion(prisma, {
      statement: `${'a'.repeat(200)}`,
    });
    await prisma.coinTransaction.create({
      data: {
        studentId: pupil.user.id,
        amount: 10,
        reason: 'correct_answer',
        sourceType: 'question',
        sourceId: question.id,
      },
    });
    const { body } = await get('/me/coins', pupil.token).expect(200);
    expect(body.data[0].description).toBe(`Acerto: ${'a'.repeat(140)}….`);
  });

  describe('GET /students/:id/coins (equipe)', () => {
    it('o professor vê o extrato de aluno da sua turma', async () => {
      const { pupil, teacher } = await studentWithStatement();
      const classroom = await createClassroom(prisma, {
        teacherId: teacher.user.id,
      });
      await prisma.classroomStudent.create({
        data: { classroomId: classroom.id, studentId: pupil.user.id },
      });
      const { body } = await get(
        `/students/${pupil.user.id}/coins?per_page=2`,
        teacher.token,
      ).expect(200);
      expect(body.meta.total).toBe(5);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].description).toBe('Estorno: Caderno.');
    });

    it('dá 404 ao professor para aluno de outro professor', async () => {
      const { pupil } = await studentWithStatement();
      const other = await sessionFor(app, Role.Teacher);
      const { body } = await get(
        `/students/${pupil.user.id}/coins`,
        other.token,
      ).expect(404);
      expect(body.message).toBe('Aluno não encontrado.');
    });

    it('o administrador vê qualquer aluno; id inexistente dá 404', async () => {
      const { pupil } = await studentWithStatement();
      const admin = await sessionFor(app, Role.Admin);
      const { body } = await get(
        `/students/${pupil.user.id}/coins`,
        admin.token,
      ).expect(200);
      expect(body.meta.total).toBe(5);
      const missing = await get('/students/999999/coins', admin.token).expect(
        404,
      );
      expect(missing.body.message).toBe('Aluno não encontrado.');
    });
  });
});
