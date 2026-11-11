import { INestApplication } from '@nestjs/common';
import type {
  ApiPlan,
  ApiPlanProgressRow,
  ApiStudentPlanProgress,
} from '@nivela/api-contract';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import {
  createCategory,
  createClassroom,
  createQuestion,
  createSubject,
  createUser,
  DEFAULT_PASSWORD,
} from './helpers/factories';
import { resetDatabase } from './helpers/reset-database';

describe('Progresso nos planos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function session(role: Role) {
    const user = await createUser(prisma, { role });
    const { body } = await http()
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: DEFAULT_PASSWORD,
        channel: role === Role.Student ? 'mobile' : 'web',
      })
      .expect(200);
    return { token: body.token as string, id: user.id };
  }

  let admin: Awaited<ReturnType<typeof session>>;
  let teacherA: Awaited<ReturnType<typeof session>>;
  let teacherB: Awaited<ReturnType<typeof session>>;
  let subjectId: number;

  /** Plano publicado com 2 capítulos de 2 questões cada. */
  async function publishedPlan(token: string, title = 'Plano de frações') {
    const category = await createCategory(prisma, { subjectId });
    const { body } = await http()
      .post('/api/v1/plans')
      .set(as(token))
      .send({ title, subject_id: subjectId })
      .expect(201);
    const chapters: Array<{ id: number; questions: number[] }> = [];
    for (const name of ['Capítulo 1', 'Capítulo 2']) {
      const withChapter = await http()
        .post(`/api/v1/plans/${body.id}/chapters`)
        .set(as(token))
        .send({ title: name })
        .expect(201);
      const chapter = (withChapter.body as ApiPlan).chapters.at(-1)!;
      const questions = [
        (await createQuestion(prisma, { subjectId, categoryId: category.id }))
          .id,
        (await createQuestion(prisma, { subjectId, categoryId: category.id }))
          .id,
      ];
      await http()
        .put(`/api/v1/plans/${body.id}/chapters/${chapter.id}/questions`)
        .set(as(token))
        .send({ question_ids: questions })
        .expect(200);
      chapters.push({ id: chapter.id, questions });
    }
    await http()
      .post(`/api/v1/plans/${body.id}/publish`)
      .set(as(token))
      .expect(200);
    return { planId: body.id as number, chapters };
  }

  const assign = (token: string, planId: number, payload: object) =>
    http()
      .post(`/api/v1/plans/${planId}/assignments`)
      .set(as(token))
      .send(payload)
      .expect(201);

  async function answer(
    studentId: number,
    chapterId: number,
    questionId: number,
    letter: string,
    attemptNumber = 1,
  ) {
    const option = await prisma.questionOption.findFirstOrThrow({
      where: { questionId, letter },
    });
    await prisma.questionAttempt.create({
      data: {
        studentId,
        questionId,
        planChapterId: chapterId,
        selectedOptionId: option.id,
        attemptNumber,
        isCorrect: option.isCorrect,
      },
    });
  }

  async function enroll(classroomId: number, name: string) {
    const student = await createUser(prisma, { name });
    await prisma.classroomStudent.create({
      data: { classroomId, studentId: student.id },
    });
    return student;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = await session(Role.Admin);
    teacherA = await session(Role.Teacher);
    teacherB = await session(Role.Teacher);
    subjectId = (await createSubject(prisma)).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /plans/:id/progress', () => {
    it('sem atribuições a lista é vazia', async () => {
      const { planId } = await publishedPlan(teacherA.token);
      const { body } = await http()
        .get(`/api/v1/plans/${planId}/progress`)
        .set(as(teacherA.token))
        .expect(200);
      expect(body).toEqual({ data: [] });
    });

    it('junta alunos da turma e diretos sem duplicar, por nome, com as contagens', async () => {
      const { planId, chapters } = await publishedPlan(teacherA.token);
      const classroom = await createClassroom(prisma, {
        teacherId: teacherA.id,
      });
      const carla = await enroll(classroom.id, 'Carla');
      const bruno = await enroll(classroom.id, 'Bruno');
      // Aluna de outra turma do mesmo professor (só assim ele pode atribuir direto).
      const ana = await enroll(
        (await createClassroom(prisma, { teacherId: teacherA.id })).id,
        'Ana',
      );
      await assign(teacherA.token, planId, { classroom_id: classroom.id });
      await assign(teacherA.token, planId, { student_id: carla.id });
      await assign(teacherA.token, planId, { student_id: ana.id });

      // Carla: capítulo 1 todo certo na 1ª; capítulo 2 uma errada e depois certa.
      const [c1, c2] = chapters;
      await answer(carla.id, c1.id, c1.questions[0], 'A');
      await answer(carla.id, c1.id, c1.questions[1], 'A');
      await answer(carla.id, c2.id, c2.questions[0], 'B');
      await answer(carla.id, c2.id, c2.questions[0], 'A', 2);
      await prisma.chapterCompletion.create({
        data: { studentId: carla.id, planChapterId: c1.id },
      });
      // Bruno: só errou uma.
      await answer(bruno.id, c1.id, c1.questions[0], 'C');
      // Tentativas de prática (sem capítulo) não contam.
      const practice = await prisma.questionOption.findFirstOrThrow({
        where: { questionId: c1.questions[1], letter: 'A' },
      });
      await prisma.questionAttempt.create({
        data: {
          studentId: ana.id,
          questionId: c1.questions[1],
          selectedOptionId: practice.id,
          attemptNumber: 1,
          isCorrect: true,
        },
      });

      const { body } = await http()
        .get(`/api/v1/plans/${planId}/progress`)
        .set(as(teacherA.token))
        .expect(200);
      const rows = body.data as ApiPlanProgressRow[];
      expect(rows.map((r) => r.student.name)).toEqual([
        'Ana',
        'Bruno',
        'Carla',
      ]);
      expect(rows[0]).toEqual({
        student: { id: ana.id, name: 'Ana' },
        completed_chapters: 0,
        total_chapters: 2,
        answered: 0,
        correct: 0,
        completed_at: null,
      });
      expect(rows[1]).toMatchObject({
        completed_chapters: 0,
        answered: 1,
        correct: 0,
      });
      expect(rows[2]).toMatchObject({
        completed_chapters: 1,
        total_chapters: 2,
        answered: 3,
        correct: 3,
        completed_at: null,
      });

      await prisma.planCompletion.create({
        data: { studentId: carla.id, levelingPlanId: planId, bonusAwarded: 50 },
      });
      const done = await http()
        .get(`/api/v1/plans/${planId}/progress`)
        .set(as(admin.token))
        .expect(200);
      expect(
        (done.body.data as ApiPlanProgressRow[])[2].completed_at,
      ).not.toBeNull();
    });

    it('professor B recebe 404 e aluno recebe 403', async () => {
      const { planId } = await publishedPlan(teacherA.token);
      const { body } = await http()
        .get(`/api/v1/plans/${planId}/progress`)
        .set(as(teacherB.token))
        .expect(404);
      expect(body.message).toBe('Plano não encontrado.');
      const student = await session(Role.Student);
      await http()
        .get(`/api/v1/plans/${planId}/progress`)
        .set(as(student.token))
        .expect(403);
    });
  });

  describe('GET /students/:id/plans', () => {
    it('lista os planos do professor atribuídos ao aluno, direto ou pela turma', async () => {
      const first = await publishedPlan(teacherA.token, 'Plano B');
      const second = await publishedPlan(teacherA.token, 'Plano A');
      const unrelated = await publishedPlan(teacherA.token, 'Plano C');
      const classroom = await createClassroom(prisma, {
        teacherId: teacherA.id,
      });
      const student = await enroll(classroom.id, 'Carla');
      await assign(teacherA.token, first.planId, {
        classroom_id: classroom.id,
        due_date: '2099-12-31',
      });
      await assign(teacherA.token, first.planId, {
        student_id: student.id,
        due_date: '2099-06-01',
      });
      await assign(teacherA.token, second.planId, {
        student_id: student.id,
      });
      const otherStudent = await enroll(
        (await createClassroom(prisma, { teacherId: teacherA.id })).id,
        'Outro',
      );
      await assign(teacherA.token, unrelated.planId, {
        student_id: otherStudent.id,
      });
      await prisma.chapterCompletion.create({
        data: {
          studentId: student.id,
          planChapterId: first.chapters[0].id,
        },
      });

      const { body } = await http()
        .get(`/api/v1/students/${student.id}/plans`)
        .set(as(teacherA.token))
        .expect(200);
      const rows = body.data as ApiStudentPlanProgress[];
      expect(rows.map((r) => r.plan.title)).toEqual(['Plano A', 'Plano B']);
      expect(rows[0]).toMatchObject({
        completed_chapters: 0,
        total_chapters: 2,
        completed_at: null,
        due_date: null,
      });
      expect(rows[0].plan.subject).toMatchObject({ id: subjectId });
      expect(rows[1]).toMatchObject({
        completed_chapters: 1,
        total_chapters: 2,
        // O prazo mais próximo entre a atribuição da turma e a direta.
        due_date: '2099-06-01',
      });
    });

    it('não mostra planos de outro professor para o mesmo aluno', async () => {
      const classroomA = await createClassroom(prisma, {
        teacherId: teacherA.id,
      });
      const student = await enroll(classroomA.id, 'Carla');
      await prisma.classroomStudent.create({
        data: {
          classroomId: (
            await createClassroom(prisma, { teacherId: teacherB.id })
          ).id,
          studentId: student.id,
        },
      });
      const planB = await publishedPlan(teacherB.token, 'Plano do B');
      await assign(teacherB.token, planB.planId, { student_id: student.id });

      const asA = await http()
        .get(`/api/v1/students/${student.id}/plans`)
        .set(as(teacherA.token))
        .expect(200);
      expect(asA.body).toEqual({ data: [] });
      const asAdmin = await http()
        .get(`/api/v1/students/${student.id}/plans`)
        .set(as(admin.token))
        .expect(200);
      expect(asAdmin.body.data).toHaveLength(1);
    });

    it('aluno fora do escopo, inexistente ou id inválido: 404; aluno logado: 403', async () => {
      const foreign = await enroll(
        (await createClassroom(prisma, { teacherId: teacherB.id })).id,
        'Alheio',
      );
      for (const id of [foreign.id, 999999, 'abc']) {
        const { body } = await http()
          .get(`/api/v1/students/${id}/plans`)
          .set(as(teacherA.token))
          .expect(404);
        expect(body.message).toBe('Aluno não encontrado.');
      }
      const student = await session(Role.Student);
      await http()
        .get(`/api/v1/students/${student.id}/plans`)
        .set(as(student.token))
        .expect(403);
    });
  });
});
