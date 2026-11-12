import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createAttempt } from './helpers/attempts';
import { createTestApp, testClock } from './helpers/create-test-app';
import {
  createClassroom,
  createQuestion,
  createReward,
} from './helpers/factories';
import { sessionFor } from './helpers/login';
import { createPlan } from './helpers/plans';
import { resetDatabase } from './helpers/reset-database';

// O relógio do app é TEST_NOW: 10/11/2026 12h em Fortaleza.
const NOW = '2026-11-10T15:00:00Z';

describe('Indicadores do início (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const get = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(`/api/v1${path}`)
      .set({ Authorization: `Bearer ${token}` });

  /** Cria um aluno novo matriculado na turma. */
  async function enroll(classroomId: number, active = true) {
    const pupil = await sessionFor(app, Role.Student);
    if (!active) {
      await prisma.user.update({
        where: { id: pupil.user.id },
        data: { active: false },
      });
    }
    await prisma.classroomStudent.create({
      data: { classroomId, studentId: pupil.user.id },
    });
    return pupil;
  }

  /** `total` questões novas terminadas pelo aluno na prática, `correct` delas certas na 1ª tentativa. */
  async function finishQuestions(
    studentId: number,
    total: number,
    correct: number,
    at: string = NOW,
  ) {
    for (let i = 0; i < total; i += 1) {
      const question = await createQuestion(prisma);
      const right = i < correct;
      await createAttempt(prisma, {
        studentId,
        questionId: question.id,
        attemptNumber: 1,
        correct: right,
        at,
      });
      if (!right) {
        await createAttempt(prisma, {
          studentId,
          questionId: question.id,
          attemptNumber: 2,
          correct: false,
          at,
        });
      }
    }
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
    testClock(app).reset();
  });

  describe('autorização', () => {
    it.each([
      '/dashboard/summary',
      '/dashboard/activity',
      '/dashboard/needing-help',
      '/dashboard/recent-questions',
    ])('GET %s: sem token 401 e aluno 403', async (path) => {
      await request(app.getHttpServer()).get(`/api/v1${path}`).expect(401);
      const student = await sessionFor(app, Role.Student);
      await get(path, student.token).expect(403);
    });
  });

  describe('GET /dashboard/summary', () => {
    it('zera tudo sem dados e deixa a taxa nula', async () => {
      const admin = await sessionFor(app, Role.Admin);
      const { body } = await get('/dashboard/summary', admin.token).expect(200);
      expect(body).toEqual({
        active_students: 0,
        active_questions: 0,
        accuracy: null,
        students_needing_help: 0,
        pending_redemptions: 0,
      });
    });

    it('conta só os alunos das turmas do professor (outro professor não entra)', async () => {
      const teacherA = await sessionFor(app, Role.Teacher);
      const teacherB = await sessionFor(app, Role.Teacher);
      const classA = await createClassroom(prisma, {
        teacherId: teacherA.user.id,
      });
      const classB = await createClassroom(prisma, {
        teacherId: teacherB.user.id,
      });
      const pupilA1 = await enroll(classA.id);
      await enroll(classA.id);
      await enroll(classA.id, false); // inativo não conta como ativo
      const pupilB = await enroll(classB.id);
      const reward = await createReward(prisma);
      for (const pupil of [pupilA1, pupilB]) {
        await prisma.rewardRedemption.create({
          data: {
            rewardId: reward.id,
            studentId: pupil.user.id,
            pricePaid: 10,
          },
        });
      }
      // A: 4 de 5 terminadas certas (80%); B: 0 de 5 (precisa de ajuda).
      await finishQuestions(pupilA1.user.id, 5, 4);
      await finishQuestions(pupilB.user.id, 5, 0);

      const a = await get('/dashboard/summary', teacherA.token).expect(200);
      expect(a.body).toMatchObject({
        active_students: 2,
        active_questions: 10,
        accuracy: 80,
        students_needing_help: 0,
        pending_redemptions: 1,
      });

      const b = await get('/dashboard/summary', teacherB.token).expect(200);
      expect(b.body).toMatchObject({
        active_students: 1,
        accuracy: 0,
        students_needing_help: 1,
        pending_redemptions: 1,
      });

      const admin = await sessionFor(app, Role.Admin);
      const all = await get('/dashboard/summary', admin.token).expect(200);
      expect(all.body).toMatchObject({
        active_students: 3,
        accuracy: 40,
        students_needing_help: 1,
        pending_redemptions: 2,
      });
    });

    it('calcula a taxa por questão terminada e por contexto, nunca por tentativa', async () => {
      const admin = await sessionFor(app, Role.Admin);
      const classroom = await createClassroom(prisma);
      const pupil = await enroll(classroom.id);
      const subject = (await createQuestion(prisma)).subjectId;
      const { chapters } = await createPlan(prisma, {
        teacherId: classroom.teacherId,
        subjectId: subject,
        chapters: [1],
      });
      const chapter = chapters[0];
      const chapterQuestion = chapter.questions[0];
      const base = { studentId: pupil.user.id, at: NOW };

      // Mesma questão: erra 2x na prática (terminada, errada)...
      await createAttempt(prisma, {
        ...base,
        questionId: chapterQuestion,
        attemptNumber: 1,
        correct: false,
      });
      await createAttempt(prisma, {
        ...base,
        questionId: chapterQuestion,
        attemptNumber: 2,
        correct: false,
      });
      // ...e acerta no capítulo (terminada, certa).
      await createAttempt(prisma, {
        ...base,
        questionId: chapterQuestion,
        chapterId: chapter.id,
        attemptNumber: 1,
        correct: true,
      });
      // Acerto na 2ª tentativa: 1 terminada, 1 certa.
      const second = await createQuestion(prisma);
      await createAttempt(prisma, {
        ...base,
        questionId: second.id,
        attemptNumber: 1,
        correct: false,
      });
      await createAttempt(prisma, {
        ...base,
        questionId: second.id,
        attemptNumber: 2,
        correct: true,
      });
      // Só a 1ª tentativa errada: não terminada, não conta.
      const open = await createQuestion(prisma);
      await createAttempt(prisma, {
        ...base,
        questionId: open.id,
        attemptNumber: 1,
        correct: false,
      });

      // 3 terminadas (prática errada, capítulo certo, 2ª certa), 2 certas: 67%.
      const { body } = await get('/dashboard/summary', admin.token).expect(200);
      expect(body.accuracy).toBe(67);
    });

    it('usa só os últimos 30 dias de estudo (relativos ao relógio do app)', async () => {
      const admin = await sessionFor(app, Role.Admin);
      const classroom = await createClassroom(prisma);
      const pupil = await enroll(classroom.id);
      // Hoje é 10/11: a janela vai de 12/10 a 10/11.
      await finishQuestions(pupil.user.id, 1, 1, '2026-10-12T03:10:00Z'); // 00h10 de 12/10: dentro
      await finishQuestions(pupil.user.id, 3, 0, '2026-10-12T02:50:00Z'); // 23h50 de 11/10: fora

      const { body } = await get('/dashboard/summary', admin.token).expect(200);
      expect(body.accuracy).toBe(100);

      testClock(app).set('2026-11-12T15:00:00Z'); // a janela anda: 14/10 a 12/11
      const later = await get('/dashboard/summary', admin.token).expect(200);
      expect(later.body.accuracy).toBeNull();
    });
  });

  describe('GET /dashboard/needing-help', () => {
    it('usa a taxa arredondada exibida: 49,5% vira 50 e não entra; 49,25% vira 49 e entra', async () => {
      const admin = await sessionFor(app, Role.Admin);
      const classroom = await createClassroom(prisma);
      const rounds50 = await enroll(classroom.id); // 50 de 101 = 49,5% -> 50
      const rounds49 = await enroll(classroom.id); // 33 de 67 = 49,25% -> 49
      await finishQuestions(rounds50.user.id, 101, 50);
      await finishQuestions(rounds49.user.id, 67, 33);

      const { body } = await get('/dashboard/needing-help', admin.token).expect(
        200,
      );
      expect(body.data).toEqual([
        {
          student: { id: rounds49.user.id, name: rounds49.user.name },
          accuracy: 49,
          finished: 67,
        },
      ]);
      const summary = await get('/dashboard/summary', admin.token).expect(200);
      expect(summary.body.students_needing_help).toBe(1);
    });

    it('ignora aluno inativo, na lista e no resumo', async () => {
      const admin = await sessionFor(app, Role.Admin);
      const classroom = await createClassroom(prisma);
      const active = await enroll(classroom.id);
      const inactive = await enroll(classroom.id, false);
      await finishQuestions(active.user.id, 5, 1);
      await finishQuestions(inactive.user.id, 5, 0);

      const { body } = await get('/dashboard/needing-help', admin.token).expect(
        200,
      );
      expect(
        body.data.map((r: { student: { id: number } }) => r.student.id),
      ).toEqual([active.user.id]);
      const summary = await get('/dashboard/summary', admin.token).expect(200);
      expect(summary.body.students_needing_help).toBe(1);
    });

    it('exige 5 questões terminadas e acerto abaixo de 50%, do menor acerto ao maior', async () => {
      const admin = await sessionFor(app, Role.Admin);
      const classroom = await createClassroom(prisma);
      const four = await enroll(classroom.id); // 0 de 4: poucas questões
      const half = await enroll(classroom.id); // 5 de 10: 50%, não entra
      const low = await enroll(classroom.id); // 1 de 5: 20%
      const lowest = await enroll(classroom.id); // 0 de 6: 0%
      await finishQuestions(four.user.id, 4, 0);
      await finishQuestions(half.user.id, 10, 5);
      await finishQuestions(low.user.id, 5, 1);
      await finishQuestions(lowest.user.id, 6, 0);

      const { body } = await get('/dashboard/needing-help', admin.token).expect(
        200,
      );
      expect(body.data).toEqual([
        {
          student: { id: lowest.user.id, name: lowest.user.name },
          accuracy: 0,
          finished: 6,
        },
        {
          student: { id: low.user.id, name: low.user.name },
          accuracy: 20,
          finished: 5,
        },
      ]);
    });

    it('lista no máximo 10 e respeita o escopo do professor', async () => {
      const teacher = await sessionFor(app, Role.Teacher);
      const mine = await createClassroom(prisma, {
        teacherId: teacher.user.id,
      });
      const other = await createClassroom(prisma);
      const outsider = await enroll(other.id);
      await finishQuestions(outsider.user.id, 5, 0);
      for (let i = 0; i < 11; i += 1) {
        const pupil = await enroll(mine.id);
        await finishQuestions(pupil.user.id, 5, 0);
      }
      const { body } = await get(
        '/dashboard/needing-help',
        teacher.token,
      ).expect(200);
      expect(body.data).toHaveLength(10);
      expect(
        body.data.map((row: { student: { id: number } }) => row.student.id),
      ).not.toContain(outsider.user.id);
      const summary = await get('/dashboard/summary', teacher.token).expect(
        200,
      );
      expect(summary.body.students_needing_help).toBe(11);
    });
  });

  describe('GET /dashboard/activity', () => {
    it('devolve um item por dia, inclusive zeros, do mais antigo ao mais novo', async () => {
      const admin = await sessionFor(app, Role.Admin);
      const classroom = await createClassroom(prisma);
      const pupil = await enroll(classroom.id);
      await finishQuestions(pupil.user.id, 2, 1, '2026-11-08T15:00:00Z');

      const { body } = await get(
        '/dashboard/activity?days=7',
        admin.token,
      ).expect(200);
      expect(body.data).toHaveLength(7);
      expect(body.data[0].day).toBe('2026-11-04');
      expect(body.data[6]).toEqual({
        day: '2026-11-10',
        answered: 0,
        correct: 0,
      });
      // Duas questões terminadas (uma certa, uma errada duas vezes): 2 e 1.
      expect(body.data[4]).toEqual({
        day: '2026-11-08',
        answered: 2,
        correct: 1,
      });
    });

    it('conta questões terminadas no dia em que terminaram, não tentativas', async () => {
      const admin = await sessionFor(app, Role.Admin);
      const classroom = await createClassroom(prisma);
      const pupil = await enroll(classroom.id);
      const student = pupil.user.id;
      // Erra no dia 07 e acerta na 2ª tentativa no dia 08: 1 respondida e 1 certa no dia 08.
      const second = await createQuestion(prisma);
      await createAttempt(prisma, {
        studentId: student,
        questionId: second.id,
        attemptNumber: 1,
        correct: false,
        at: '2026-11-07T15:00:00Z',
      });
      await createAttempt(prisma, {
        studentId: student,
        questionId: second.id,
        attemptNumber: 2,
        correct: true,
        at: '2026-11-08T15:00:00Z',
      });
      // Só a 1ª tentativa errada: não terminou, não conta em dia nenhum.
      const open = await createQuestion(prisma);
      await createAttempt(prisma, {
        studentId: student,
        questionId: open.id,
        attemptNumber: 1,
        correct: false,
        at: '2026-11-09T15:00:00Z',
      });

      const { body } = await get(
        '/dashboard/activity?days=7',
        admin.token,
      ).expect(200);
      const byDay = Object.fromEntries(
        body.data.map(
          (d: { day: string; answered: number; correct: number }) => [
            d.day,
            [d.answered, d.correct],
          ],
        ),
      );
      expect(byDay['2026-11-07']).toEqual([0, 0]);
      expect(byDay['2026-11-08']).toEqual([1, 1]);
      expect(byDay['2026-11-09']).toEqual([0, 0]);
    });

    it('separa 23h50 e 00h10 de Fortaleza em dias diferentes', async () => {
      const admin = await sessionFor(app, Role.Admin);
      const classroom = await createClassroom(prisma);
      const pupil = await enroll(classroom.id);
      await finishQuestions(pupil.user.id, 1, 1, '2026-11-09T02:50:00Z'); // 23h50 de 08/11
      await finishQuestions(pupil.user.id, 1, 1, '2026-11-09T03:10:00Z'); // 00h10 de 09/11
      await finishQuestions(pupil.user.id, 1, 1, '2026-11-10T02:50:00Z'); // 23h50 de 09/11

      const { body } = await get(
        '/dashboard/activity?days=7',
        admin.token,
      ).expect(200);
      const byDay = Object.fromEntries(
        body.data.map((d: { day: string; answered: number }) => [
          d.day,
          d.answered,
        ]),
      );
      expect(byDay['2026-11-08']).toBe(1);
      expect(byDay['2026-11-09']).toBe(2);
      expect(byDay['2026-11-10']).toBe(0);
    });

    it('conta só os alunos do escopo e segue o relógio do app', async () => {
      const teacher = await sessionFor(app, Role.Teacher);
      const mine = await createClassroom(prisma, {
        teacherId: teacher.user.id,
      });
      const other = await createClassroom(prisma);
      const own = await enroll(mine.id);
      const outsider = await enroll(other.id);
      await finishQuestions(own.user.id, 1, 1);
      await finishQuestions(outsider.user.id, 4, 4);

      const today = await get(
        '/dashboard/activity?days=7',
        teacher.token,
      ).expect(200);
      expect(today.body.data.at(-1)).toEqual({
        day: '2026-11-10',
        answered: 1,
        correct: 1,
      });

      testClock(app).set('2026-11-11T15:00:00Z');
      const tomorrow = await get(
        '/dashboard/activity?days=7',
        teacher.token,
      ).expect(200);
      expect(tomorrow.body.data.at(-1).day).toBe('2026-11-11');
      expect(tomorrow.body.data.at(-2).answered).toBe(1);
    });

    it('valida days (7 a 60, padrão 14)', async () => {
      const admin = await sessionFor(app, Role.Admin);
      const standard = await get('/dashboard/activity', admin.token).expect(
        200,
      );
      expect(standard.body.data).toHaveLength(14);
      await get('/dashboard/activity?days=6', admin.token).expect(422);
      await get('/dashboard/activity?days=61', admin.token).expect(422);
      await get('/dashboard/activity?days=abc', admin.token).expect(422);
      const max = await get('/dashboard/activity?days=60', admin.token).expect(
        200,
      );
      expect(max.body.data).toHaveLength(60);
    });
  });

  describe('GET /dashboard/recent-questions', () => {
    it('devolve as 5 questões ativas mais recentes da escola, mesmo de outro professor', async () => {
      const teacher = await sessionFor(app, Role.Teacher);
      const created: number[] = [];
      for (let i = 0; i < 6; i += 1) {
        created.push((await createQuestion(prisma)).id);
      }
      const inactive = await createQuestion(prisma, { active: false });

      const { body } = await get(
        '/dashboard/recent-questions',
        teacher.token,
      ).expect(200);
      const ids = body.data.map((q: { id: number }) => q.id);
      expect(ids).toEqual(created.slice(1).reverse());
      expect(ids).not.toContain(inactive.id);
      expect(body.data[0]).toEqual(
        expect.objectContaining({
          statement_excerpt: expect.any(String),
          subject: expect.objectContaining({ color: 'teal' }),
        }),
      );
    });
  });
});
