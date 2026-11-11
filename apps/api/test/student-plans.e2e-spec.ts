import { INestApplication } from '@nestjs/common';
import type {
  ApiChapterNext,
  ApiMyPlan,
  ApiMyPlanSummary,
} from '@nivela/api-contract';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import {
  createClassroom,
  createQuestion,
  createSubject,
  createUser,
} from './helpers/factories';
import { sessionFor } from './helpers/login';
import { createPlan } from './helpers/plans';
import { resetDatabase } from './helpers/reset-database';

const NOT_FOUND_PLAN = 'Plano não encontrado.';
const NOT_FOUND_CHAPTER = 'Capítulo não encontrado.';
const LOCKED = 'Conclua o capítulo anterior para liberar este.';

describe('Planos do aluno (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let teacherId: number;
  let subjectId: number;
  let student: Awaited<ReturnType<typeof sessionFor>>;

  const get = (path: string, token = student.token) =>
    request(app.getHttpServer())
      .get(`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`);

  const day = (value: string | undefined) =>
    value ? new Date(`${value}T00:00:00.000Z`) : null;

  async function assignToClassroomOf(
    planId: number,
    studentId: number,
    due?: string,
  ) {
    const classroom = await createClassroom(prisma, { teacherId });
    await prisma.classroomStudent.create({
      data: { classroomId: classroom.id, studentId },
    });
    await prisma.planAssignment.create({
      data: {
        levelingPlanId: planId,
        classroomId: classroom.id,
        dueDate: day(due),
      },
    });
  }
  const assignDirect = (planId: number, studentId: number, due?: string) =>
    prisma.planAssignment.create({
      data: { levelingPlanId: planId, studentId, dueDate: day(due) },
    });
  const complete = (planChapterId: number) =>
    prisma.chapterCompletion.create({
      data: { studentId: student.user.id, planChapterId },
    });
  const optionOf = (questionId: number, letter: string) =>
    prisma.questionOption.findFirstOrThrow({ where: { questionId, letter } });
  async function attempt(
    questionId: number,
    planChapterId: number | null,
    letter: string,
    attemptNumber = 1,
  ) {
    const option = await optionOf(questionId, letter);
    await prisma.questionAttempt.create({
      data: {
        studentId: student.user.id,
        questionId,
        planChapterId,
        selectedOptionId: option.id,
        attemptNumber,
        isCorrect: option.isCorrect,
      },
    });
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
    teacherId = (await createUser(prisma, { role: Role.Teacher })).id;
    subjectId = (await createSubject(prisma)).id;
    student = await sessionFor(app, Role.Student);
  });

  describe('visibilidade (Review Focus 5)', () => {
    it('aluno da turma atribuída vê o plano na lista e no detalhe', async () => {
      const { planId } = await createPlan(prisma, {
        teacherId,
        subjectId,
        chapters: [2, 1],
      });
      await assignToClassroomOf(planId, student.user.id);
      const list = await get('/me/plans').expect(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0]).toMatchObject({
        id: planId,
        title: 'Plano de frações',
        completed: false,
        completion_bonus: 50,
        due_date: null,
        progress: { completed_chapters: 0, total_chapters: 2, percent: 0 },
      });
      expect(list.body.data[0].subject).toHaveProperty('icon');
      await get(`/me/plans/${planId}`).expect(200);
    });

    it('aluno de outra turma recebe 404 (e lista vazia)', async () => {
      const { planId, chapters } = await createPlan(prisma, {
        teacherId,
        subjectId,
        chapters: [1],
      });
      const other = await sessionFor(app, Role.Student);
      await assignToClassroomOf(planId, other.user.id);
      expect((await get('/me/plans').expect(200)).body).toEqual({ data: [] });
      const detail = await get(`/me/plans/${planId}`).expect(404);
      expect(detail.body.message).toBe(NOT_FOUND_PLAN);
      const next = await get(
        `/me/plans/${planId}/chapters/${chapters[0].id}/next`,
      ).expect(404);
      expect(next.body.message).toBe(NOT_FOUND_PLAN);
    });

    it('rascunho atribuído não aparece', async () => {
      const { planId } = await createPlan(prisma, {
        teacherId,
        subjectId,
        chapters: [1],
        status: 'draft',
      });
      await assignDirect(planId, student.user.id);
      expect((await get('/me/plans').expect(200)).body).toEqual({ data: [] });
      await get(`/me/plans/${planId}`).expect(404);
    });

    it('plano inexistente e id inválido respondem 404', async () => {
      await get('/me/plans/999999').expect(404);
      await get('/me/plans/abc').expect(404);
    });

    it('equipe recebe 403 e anônimo 401', async () => {
      const staff = await sessionFor(app, Role.Teacher);
      await get('/me/plans', staff.token).expect(403);
      await request(app.getHttpServer()).get('/api/v1/me/plans').expect(401);
    });
  });

  describe('GET /me/plans', () => {
    it('não concluídos primeiro, depois prazo (sem prazo por último) e título; percent e menor prazo', async () => {
      const mk = (title: string) =>
        createPlan(prisma, {
          teacherId,
          subjectId,
          chapters: [1, 1, 1],
          title,
        });
      const done = await mk('A concluído');
      const late = await mk('B prazo tarde');
      const soon = await mk('C prazo cedo');
      const none = await mk('D sem prazo');
      const alpha = await mk('Alfa sem prazo');
      const me = student.user.id;
      await assignDirect(done.planId, me);
      await assignDirect(late.planId, me, '2099-03-01');
      // O menor prazo entre a atribuição direta e a da turma vale.
      await assignDirect(soon.planId, me, '2099-02-01');
      await assignToClassroomOf(soon.planId, me, '2099-01-10');
      await assignDirect(none.planId, me);
      await assignDirect(alpha.planId, me);
      await prisma.planCompletion.create({
        data: { studentId: me, levelingPlanId: done.planId },
      });
      for (const chapter of done.chapters) await complete(chapter.id);
      await complete(soon.chapters[0].id);

      const { body } = await get('/me/plans').expect(200);
      const rows = body.data as ApiMyPlanSummary[];
      expect(rows.map((r) => r.title)).toEqual([
        'C prazo cedo',
        'B prazo tarde',
        'Alfa sem prazo',
        'D sem prazo',
        'A concluído',
      ]);
      expect(rows[0]).toMatchObject({
        due_date: '2099-01-10',
        progress: { completed_chapters: 1, total_chapters: 3, percent: 33 },
      });
      expect(rows[4]).toMatchObject({
        completed: true,
        progress: { completed_chapters: 3, total_chapters: 3, percent: 100 },
      });
    });
  });

  describe('GET /me/plans/:id (RN06)', () => {
    it('capítulo 1 disponível, os demais trancados; concluir libera só o seguinte', async () => {
      const { planId, chapters } = await createPlan(prisma, {
        teacherId,
        subjectId,
        chapters: [2, 1, 1],
      });
      await assignDirect(planId, student.user.id);
      let { body } = await get(`/me/plans/${planId}`).expect(200);
      expect(
        (body as ApiMyPlan).chapters.map((c) => [c.position, c.state, c.total]),
      ).toEqual([
        [1, 'available', 2],
        [2, 'locked', 1],
        [3, 'locked', 1],
      ]);

      await complete(chapters[0].id);
      ({ body } = await get(`/me/plans/${planId}`).expect(200));
      expect((body as ApiMyPlan).chapters.map((c) => c.state)).toEqual([
        'completed',
        'available',
        'locked',
      ]);
      expect((body as ApiMyPlan).progress).toEqual({
        completed_chapters: 1,
        total_chapters: 3,
        percent: 33,
      });
    });

    it('Ruling 4: capítulo sem questões ativas conta como concluído e não trava o aluno', async () => {
      const { planId, chapters } = await createPlan(prisma, {
        teacherId,
        subjectId,
        chapters: [1, 1, 1],
      });
      await assignDirect(planId, student.user.id);
      await prisma.question.updateMany({
        where: { id: { in: chapters[0].questions } },
        data: { active: false },
      });
      const { body } = await get(`/me/plans/${planId}`).expect(200);
      const plan = body as ApiMyPlan;
      expect(plan.chapters.map((c) => [c.state, c.answered, c.total])).toEqual([
        ['completed', 0, 0],
        ['available', 0, 1],
        ['locked', 0, 1],
      ]);
      expect(plan.progress.completed_chapters).toBe(1);
    });

    it('answered conta só questões ativas terminadas no capítulo (não na prática)', async () => {
      const { planId, chapters } = await createPlan(prisma, {
        teacherId,
        subjectId,
        chapters: [3],
      });
      await assignDirect(planId, student.user.id);
      const [q1, q2, q3] = chapters[0].questions;
      await attempt(q1, chapters[0].id, 'A');
      await attempt(q2, null, 'A'); // prática: não conta
      await attempt(q3, chapters[0].id, 'A');
      await prisma.question.update({
        where: { id: q3 },
        data: { active: false },
      });
      const { body } = await get(`/me/plans/${planId}`).expect(200);
      expect((body as ApiMyPlan).chapters[0]).toMatchObject({
        answered: 1,
        total: 2,
      });
    });
  });

  describe('GET /me/plans/:id/chapters/:chapterId/next', () => {
    it('devolve a primeira questão ativa pela posição, sem correct_letter nem explanation (Review Focus 1)', async () => {
      const { planId, chapters } = await createPlan(prisma, {
        teacherId,
        subjectId,
        chapters: [3],
      });
      await assignDirect(planId, student.user.id);
      const [q1, q2] = chapters[0].questions;
      await prisma.question.update({
        where: { id: q1 },
        data: { active: false },
      });
      const { body } = await get(
        `/me/plans/${planId}/chapters/${chapters[0].id}/next`,
      ).expect(200);
      const next = body as ApiChapterNext;
      expect(next.question?.id).toBe(q2);
      expect(next.question?.attempts_left).toBe(2);
      expect(next.remaining).toBe(2);
      const text = JSON.stringify(body);
      expect(text).not.toContain('correct_letter');
      expect(text).not.toContain('explanation');
      expect(text).not.toContain('is_correct');
    });

    it('pula questão terminada no capítulo, mas não a terminada só na prática; attempts_left reflete o erro', async () => {
      const { planId, chapters } = await createPlan(prisma, {
        teacherId,
        subjectId,
        chapters: [2],
      });
      await assignDirect(planId, student.user.id);
      const [q1, q2] = chapters[0].questions;
      const path = `/me/plans/${planId}/chapters/${chapters[0].id}/next`;
      await attempt(q1, null, 'A'); // prática terminada: continua no capítulo
      let { body } = await get(path).expect(200);
      expect(body.question.id).toBe(q1);
      await attempt(q1, chapters[0].id, 'B'); // errou uma no capítulo
      ({ body } = await get(path).expect(200));
      expect(body.question).toMatchObject({ id: q1, attempts_left: 1 });
      await attempt(q1, chapters[0].id, 'A', 2); // terminou q1 no capítulo
      ({ body } = await get(path).expect(200));
      expect(body.question.id).toBe(q2);
      expect(body.remaining).toBe(1);
      await attempt(q2, chapters[0].id, 'A');
      ({ body } = await get(path).expect(200));
      expect(body).toEqual({ question: null, remaining: 0 });
    });

    it('capítulo trancado → 409; liberado ao concluir o anterior', async () => {
      const { planId, chapters } = await createPlan(prisma, {
        teacherId,
        subjectId,
        chapters: [1, 1],
      });
      await assignDirect(planId, student.user.id);
      const path = `/me/plans/${planId}/chapters/${chapters[1].id}/next`;
      const locked = await get(path).expect(409);
      expect(locked.body.message).toBe(LOCKED);
      await complete(chapters[0].id);
      const { body } = await get(path).expect(200);
      expect(body.question.id).toBe(chapters[1].questions[0]);
    });

    it('capítulo de outro plano ou inexistente → 404 "Capítulo não encontrado."', async () => {
      const a = await createPlan(prisma, {
        teacherId,
        subjectId,
        chapters: [1],
      });
      const b = await createPlan(prisma, {
        teacherId,
        subjectId,
        chapters: [1],
      });
      await assignDirect(a.planId, student.user.id);
      await assignDirect(b.planId, student.user.id);
      for (const chapterId of [b.chapters[0].id, 999999]) {
        const { body } = await get(
          `/me/plans/${a.planId}/chapters/${chapterId}/next`,
        ).expect(404);
        expect(body.message).toBe(NOT_FOUND_CHAPTER);
      }
    });

    it('questões fora do capítulo não entram', async () => {
      const { planId, chapters } = await createPlan(prisma, {
        teacherId,
        subjectId,
        chapters: [1],
      });
      await assignDirect(planId, student.user.id);
      await createQuestion(prisma, { subjectId });
      const { body } = await get(
        `/me/plans/${planId}/chapters/${chapters[0].id}/next`,
      ).expect(200);
      expect(body.remaining).toBe(1);
    });
  });

  describe('restrições deferidas das posições', () => {
    it('plan_chapters_position_key e chapter_question_position_key são DEFERRABLE INITIALLY DEFERRED', async () => {
      const rows = await prisma.$queryRaw<
        Array<{ conname: string; condeferrable: boolean; condeferred: boolean }>
      >`
        SELECT conname, condeferrable, condeferred FROM pg_constraint
        WHERE conname IN ('plan_chapters_position_key', 'chapter_question_position_key')
        ORDER BY conname`;
      expect(rows).toEqual([
        {
          conname: 'chapter_question_position_key',
          condeferrable: true,
          condeferred: true,
        },
        {
          conname: 'plan_chapters_position_key',
          condeferrable: true,
          condeferred: true,
        },
      ]);
    });
  });
});
