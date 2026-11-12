import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createAttempt } from './helpers/attempts';
import { createTestApp, testClock } from './helpers/create-test-app';
import {
  createCategory,
  createClassroom,
  createQuestion,
  createSubject,
} from './helpers/factories';
import { sessionFor } from './helpers/login';
import { createPlan } from './helpers/plans';
import { resetDatabase } from './helpers/reset-database';

const NOW = '2026-11-10T15:00:00Z';

describe('Desempenho por categoria (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const get = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(`/api/v1${path}`)
      .set({ Authorization: `Bearer ${token}` });

  async function enroll(classroomId: number) {
    const pupil = await sessionFor(app, Role.Student);
    await prisma.classroomStudent.create({
      data: { classroomId, studentId: pupil.user.id },
    });
    return pupil;
  }

  /** Responde a questão na prática: certa de primeira, ou errada duas vezes. */
  async function practice(
    studentId: number,
    questionId: number,
    right: boolean,
    at: string = NOW,
  ) {
    await createAttempt(prisma, {
      studentId,
      questionId,
      attemptNumber: 1,
      correct: right,
      at,
    });
    if (!right) {
      await createAttempt(prisma, {
        studentId,
        questionId,
        attemptNumber: 2,
        correct: false,
        at,
      });
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
    it('aluno recebe 403 e sem token 401', async () => {
      const student = await sessionFor(app, Role.Student);
      for (const path of [
        '/classrooms/1/performance',
        '/students/1/performance',
      ]) {
        await request(app.getHttpServer()).get(`/api/v1${path}`).expect(401);
        await get(path, student.token).expect(403);
      }
    });
  });

  describe('GET /classrooms/:id/performance', () => {
    it('agrega por categoria os alunos da turma, contando cada contexto uma vez', async () => {
      const teacher = await sessionFor(app, Role.Teacher);
      const classroom = await createClassroom(prisma, {
        teacherId: teacher.user.id,
      });
      const maria = await enroll(classroom.id);
      const joao = await enroll(classroom.id);
      const subject = await createSubject(prisma, {
        name: 'Matemática',
        color: 'blue',
      });
      const fractions = await createCategory(prisma, {
        subjectId: subject.id,
        name: 'Frações',
      });
      const geometry = await createCategory(prisma, {
        subjectId: subject.id,
        name: 'Geometria',
      });
      const q1 = await createQuestion(prisma, { categoryId: fractions.id });
      const q2 = await createQuestion(prisma, { categoryId: fractions.id });
      const q3 = await createQuestion(prisma, { categoryId: geometry.id });

      await practice(maria.user.id, q1.id, true);
      await practice(maria.user.id, q2.id, false);
      await practice(joao.user.id, q1.id, false);
      await practice(joao.user.id, q3.id, true);
      // Tentativa não terminada (só a 1ª errada): não conta.
      await createAttempt(prisma, {
        studentId: joao.user.id,
        questionId: q2.id,
        attemptNumber: 1,
        correct: false,
        at: NOW,
      });

      const { body } = await get(
        `/classrooms/${classroom.id}/performance`,
        teacher.token,
      ).expect(200);
      expect(body.data).toEqual([
        {
          category: { id: fractions.id, name: 'Frações' },
          subject: { id: subject.id, name: 'Matemática', color: 'blue' },
          finished: 3,
          correct: 1,
          accuracy: 33,
        },
        {
          category: { id: geometry.id, name: 'Geometria' },
          subject: { id: subject.id, name: 'Matemática', color: 'blue' },
          finished: 1,
          correct: 1,
          accuracy: 100,
        },
      ]);
    });

    it('a mesma questão na prática e no capítulo conta duas vezes, uma por contexto', async () => {
      const teacher = await sessionFor(app, Role.Teacher);
      const classroom = await createClassroom(prisma, {
        teacherId: teacher.user.id,
      });
      const pupil = await enroll(classroom.id);
      const subject = await createSubject(prisma);
      const { chapters } = await createPlan(prisma, {
        teacherId: teacher.user.id,
        subjectId: subject.id,
        chapters: [1],
      });
      const questionId = chapters[0].questions[0];
      await practice(pupil.user.id, questionId, false);
      await createAttempt(prisma, {
        studentId: pupil.user.id,
        questionId,
        chapterId: chapters[0].id,
        attemptNumber: 2,
        correct: true,
        at: NOW,
      });

      const { body } = await get(
        `/classrooms/${classroom.id}/performance`,
        teacher.token,
      ).expect(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        finished: 2,
        correct: 1,
        accuracy: 50,
      });
    });

    it('considera todo o histórico, não só os últimos 30 dias', async () => {
      const teacher = await sessionFor(app, Role.Teacher);
      const classroom = await createClassroom(prisma, {
        teacherId: teacher.user.id,
      });
      const pupil = await enroll(classroom.id);
      const question = await createQuestion(prisma);
      await practice(pupil.user.id, question.id, true, '2026-01-05T15:00:00Z');

      const { body } = await get(
        `/classrooms/${classroom.id}/performance`,
        teacher.token,
      ).expect(200);
      expect(body.data[0]).toMatchObject({ finished: 1, correct: 1 });
    });

    it('devolve lista vazia para turma sem respostas', async () => {
      const admin = await sessionFor(app, Role.Admin);
      const classroom = await createClassroom(prisma);
      await enroll(classroom.id);
      const { body } = await get(
        `/classrooms/${classroom.id}/performance`,
        admin.token,
      ).expect(200);
      expect(body).toEqual({ data: [] });
    });

    it('não mostra alunos de outras turmas e dá 404 para turma de outro professor', async () => {
      const teacher = await sessionFor(app, Role.Teacher);
      const mine = await createClassroom(prisma, {
        teacherId: teacher.user.id,
      });
      const other = await createClassroom(prisma);
      const outsider = await enroll(other.id);
      await practice(outsider.user.id, (await createQuestion(prisma)).id, true);

      const own = await get(
        `/classrooms/${mine.id}/performance`,
        teacher.token,
      ).expect(200);
      expect(own.body.data).toEqual([]);

      const denied = await get(
        `/classrooms/${other.id}/performance`,
        teacher.token,
      ).expect(404);
      expect(denied.body.message).toBe('Turma não encontrada.');

      const admin = await sessionFor(app, Role.Admin);
      const all = await get(
        `/classrooms/${other.id}/performance`,
        admin.token,
      ).expect(200);
      expect(all.body.data).toHaveLength(1);
    });

    it('dá 404 para turma inexistente ou id inválido', async () => {
      const admin = await sessionFor(app, Role.Admin);
      for (const id of ['999999', 'abc']) {
        const { body } = await get(
          `/classrooms/${id}/performance`,
          admin.token,
        ).expect(404);
        expect(body.message).toBe('Turma não encontrada.');
      }
    });
  });

  describe('GET /students/:id/performance', () => {
    it('devolve o desempenho do aluno por categoria', async () => {
      const teacher = await sessionFor(app, Role.Teacher);
      const classroom = await createClassroom(prisma, {
        teacherId: teacher.user.id,
      });
      const pupil = await enroll(classroom.id);
      const mate = await enroll(classroom.id);
      const category = await createCategory(prisma, { name: 'Equações' });
      const q1 = await createQuestion(prisma, { categoryId: category.id });
      const q2 = await createQuestion(prisma, { categoryId: category.id });
      await practice(pupil.user.id, q1.id, true);
      await practice(pupil.user.id, q2.id, false);
      await practice(mate.user.id, q1.id, false);

      const { body } = await get(
        `/students/${pupil.user.id}/performance`,
        teacher.token,
      ).expect(200);
      expect(body.data).toEqual([
        expect.objectContaining({
          category: { id: category.id, name: 'Equações' },
          finished: 2,
          correct: 1,
          accuracy: 50,
        }),
      ]);
    });

    it('dá 404 para aluno fora do escopo, inexistente ou que não é aluno', async () => {
      const teacher = await sessionFor(app, Role.Teacher);
      const other = await createClassroom(prisma);
      const outsider = await enroll(other.id);
      const noClass = await sessionFor(app, Role.Student);

      for (const id of [
        outsider.user.id,
        noClass.user.id,
        teacher.user.id,
        999999,
      ]) {
        const { body } = await get(
          `/students/${id}/performance`,
          teacher.token,
        ).expect(404);
        expect(body.message).toBe('Aluno não encontrado.');
      }

      const admin = await sessionFor(app, Role.Admin);
      await get(`/students/${noClass.user.id}/performance`, admin.token).expect(
        200,
      );
    });
  });
});
