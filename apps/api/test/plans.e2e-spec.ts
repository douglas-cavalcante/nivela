import { INestApplication } from '@nestjs/common';
import type { ApiPlan } from '@nivela/api-contract';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import {
  createCategory,
  createQuestion,
  createSubject,
  createUser,
  DEFAULT_PASSWORD,
} from './helpers/factories';
import { resetDatabase } from './helpers/reset-database';

const NOT_FOUND = 'Plano não encontrado.';
const HAS_PROGRESS =
  'O plano já tem progresso de alunos; não é possível remover capítulos ou questões.';
const QUESTIONS_MESSAGE = 'Escolha questões ativas da disciplina do plano.';
const EMPTY_PUBLISH =
  'Adicione ao menos um capítulo com questões antes de publicar.';

describe('Planos de nivelamento (e2e)', () => {
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

  const createPlan = async (
    token: string,
    overrides: Record<string, unknown> = {},
  ) =>
    (
      await http()
        .post('/api/v1/plans')
        .set(as(token))
        .send({
          title: 'Plano de frações',
          subject_id: subjectId,
          ...overrides,
        })
        .expect(201)
    ).body as ApiPlan;

  const addChapter = async (token: string, planId: number, title: string) =>
    (
      await http()
        .post(`/api/v1/plans/${planId}/chapters`)
        .set(as(token))
        .send({ title })
        .expect(201)
    ).body as ApiPlan;

  const setQuestions = (
    token: string,
    planId: number,
    chapterId: number,
    ids: number[],
  ) =>
    http()
      .put(`/api/v1/plans/${planId}/chapters/${chapterId}/questions`)
      .set(as(token))
      .send({ question_ids: ids });

  /** Plano em rascunho com um capítulo e duas questões da disciplina. */
  async function planWithQuestions(token: string) {
    const category = await createCategory(prisma, { subjectId });
    const q1 = await createQuestion(prisma, {
      subjectId,
      categoryId: category.id,
    });
    const q2 = await createQuestion(prisma, {
      subjectId,
      categoryId: category.id,
    });
    const plan = await createPlan(token);
    const withChapter = await addChapter(token, plan.id, 'Capítulo 1');
    const chapterId = withChapter.chapters[0].id;
    await setQuestions(token, plan.id, chapterId, [q1.id, q2.id]).expect(200);
    return { planId: plan.id, chapterId, q1, q2 };
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

  describe('CRUD do plano', () => {
    it('cria em rascunho com bônus padrão 50 e o professor como dono', async () => {
      const plan = await createPlan(teacherA.token, {
        title: '  Plano de frações  ',
        description: '  Revisão.  ',
      });
      expect(plan).toMatchObject({
        title: 'Plano de frações',
        description: 'Revisão.',
        status: 'draft',
        completion_bonus: 50,
        chapters: [],
        chapters_count: 0,
        questions_count: 0,
        assignments_count: 0,
        has_progress: false,
        can_edit: true,
        teacher: { id: teacherA.id },
      });
    });

    it('valida os campos em 422 e a disciplina inexistente', async () => {
      const { body } = await http()
        .post('/api/v1/plans')
        .set(as(teacherA.token))
        .send({ title: 'ab', completion_bonus: 501 })
        .expect(422);
      expect(Object.keys(body.errors).sort()).toEqual([
        'completion_bonus',
        'subject_id',
        'title',
      ]);
      const missing = await http()
        .post('/api/v1/plans')
        .set(as(teacherA.token))
        .send({ title: 'Plano', subject_id: 999999 })
        .expect(422);
      expect(missing.body.errors.subject_id).toEqual([
        'Disciplina não encontrada.',
      ]);
    });

    it('edita os dados e limpa a descrição com null', async () => {
      const plan = await createPlan(teacherA.token, { description: 'x' });
      const { body } = await http()
        .put(`/api/v1/plans/${plan.id}`)
        .set(as(teacherA.token))
        .send({
          title: 'Novo título',
          description: null,
          subject_id: subjectId,
          completion_bonus: 100,
        })
        .expect(200);
      expect(body).toMatchObject({
        title: 'Novo título',
        description: null,
        completion_bonus: 100,
      });
    });

    it('não troca a disciplina de plano que já tem questões', async () => {
      const { planId } = await planWithQuestions(teacherA.token);
      const other = await createSubject(prisma);
      const { body } = await http()
        .put(`/api/v1/plans/${planId}`)
        .set(as(teacherA.token))
        .send({ title: 'Plano', subject_id: other.id })
        .expect(422);
      expect(body.errors).toHaveProperty('subject_id');
    });

    it('lista paginada com filtros de busca, situação e disciplina', async () => {
      const other = await createSubject(prisma);
      await createPlan(teacherA.token, { title: 'Frações básicas' });
      await createPlan(teacherA.token, {
        title: 'Geometria',
        subject_id: other.id,
      });
      const { planId } = await planWithQuestions(teacherA.token);
      await http()
        .post(`/api/v1/plans/${planId}/publish`)
        .set(as(teacherA.token))
        .expect(200);

      const all = await http()
        .get('/api/v1/plans')
        .set(as(teacherA.token))
        .expect(200);
      expect(all.body.meta.total).toBe(3);
      const search = await http()
        .get('/api/v1/plans?search=geom&status=')
        .set(as(teacherA.token))
        .expect(200);
      expect(search.body.data.map((p: { title: string }) => p.title)).toEqual([
        'Geometria',
      ]);
      const published = await http()
        .get('/api/v1/plans?status=published')
        .set(as(teacherA.token))
        .expect(200);
      expect(published.body.data).toHaveLength(1);
      expect(published.body.data[0]).toMatchObject({
        status: 'published',
        chapters_count: 1,
        questions_count: 2,
        assignments_count: 0,
      });
      const bySubject = await http()
        .get(`/api/v1/plans?subject_id=${other.id}`)
        .set(as(teacherA.token))
        .expect(200);
      expect(bySubject.body.data).toHaveLength(1);
    });

    it('exclui rascunho; plano publicado responde 409', async () => {
      const draft = await createPlan(teacherA.token);
      await http()
        .delete(`/api/v1/plans/${draft.id}`)
        .set(as(teacherA.token))
        .expect(204);
      await http()
        .get(`/api/v1/plans/${draft.id}`)
        .set(as(teacherA.token))
        .expect(404);

      const { planId } = await planWithQuestions(teacherA.token);
      await http()
        .post(`/api/v1/plans/${planId}/publish`)
        .set(as(teacherA.token))
        .expect(200);
      const { body } = await http()
        .delete(`/api/v1/plans/${planId}`)
        .set(as(teacherA.token))
        .expect(409);
      expect(body.message).toBe('Só é possível excluir planos em rascunho.');
    });
  });

  describe('escopo (RN15) e perfis', () => {
    it('professor B não vê, edita nem exclui plano do A (404); admin vê tudo', async () => {
      const { planId, chapterId, q1 } = await planWithQuestions(teacherA.token);
      const bearer = as(teacherB.token);
      const attempts = [
        http().get(`/api/v1/plans/${planId}`).set(bearer),
        http()
          .put(`/api/v1/plans/${planId}`)
          .set(bearer)
          .send({ title: 'Invadido', subject_id: subjectId }),
        http().delete(`/api/v1/plans/${planId}`).set(bearer),
        http().post(`/api/v1/plans/${planId}/publish`).set(bearer),
        http()
          .post(`/api/v1/plans/${planId}/chapters`)
          .set(bearer)
          .send({ title: 'Capítulo X' }),
        http()
          .put(`/api/v1/plans/${planId}/chapters/${chapterId}`)
          .set(bearer)
          .send({ title: 'Capítulo X' }),
        http()
          .delete(`/api/v1/plans/${planId}/chapters/${chapterId}`)
          .set(bearer),
        http()
          .put(`/api/v1/plans/${planId}/chapters/order`)
          .set(bearer)
          .send({ chapter_ids: [chapterId] }),
        setQuestions(teacherB.token, planId, chapterId, [q1.id]),
      ];
      for (const pending of attempts) {
        const { status, body } = await pending;
        expect(status).toBe(404);
        expect(body.message).toBe(NOT_FOUND);
      }
      const list = await http().get('/api/v1/plans').set(bearer).expect(200);
      expect(list.body.data).toEqual([]);

      const untouched = await prisma.levelingPlan.findUniqueOrThrow({
        where: { id: planId },
        include: { chapters: { include: { questions: true } } },
      });
      expect(untouched.title).toBe('Plano de frações');
      expect(untouched.chapters).toHaveLength(1);
      expect(untouched.chapters[0].questions).toHaveLength(2);

      const asAdmin = await http()
        .get(`/api/v1/plans/${planId}`)
        .set(as(admin.token))
        .expect(200);
      expect(asAdmin.body.teacher.id).toBe(teacherA.id);
      const adminList = await http()
        .get('/api/v1/plans')
        .set(as(admin.token))
        .expect(200);
      expect(adminList.body.meta.total).toBe(1);
    });

    it('id inválido responde 404 e aluno recebe 403', async () => {
      await http().get('/api/v1/plans/abc').set(as(teacherA.token)).expect(404);
      const student = await session(Role.Student);
      await http().get('/api/v1/plans').set(as(student.token)).expect(403);
      await http()
        .post('/api/v1/plans')
        .set(as(student.token))
        .send({ title: 'Plano', subject_id: subjectId })
        .expect(403);
      await http().get('/api/v1/plans').expect(401);
    });
  });

  describe('capítulos', () => {
    it('cria em sequência, renomeia e remove fechando o buraco', async () => {
      const plan = await createPlan(teacherA.token);
      await addChapter(teacherA.token, plan.id, 'Um');
      await addChapter(teacherA.token, plan.id, 'Dois');
      const three = await addChapter(teacherA.token, plan.id, 'Três');
      expect(three.chapters.map((c) => [c.title, c.position])).toEqual([
        ['Um', 1],
        ['Dois', 2],
        ['Três', 3],
      ]);

      const renamed = await http()
        .put(`/api/v1/plans/${plan.id}/chapters/${three.chapters[1].id}`)
        .set(as(teacherA.token))
        .send({ title: '  Dois b  ' })
        .expect(200);
      expect(renamed.body.chapters[1].title).toBe('Dois b');

      const removed = await http()
        .delete(`/api/v1/plans/${plan.id}/chapters/${three.chapters[0].id}`)
        .set(as(teacherA.token))
        .expect(200);
      expect(
        (removed.body as ApiPlan).chapters.map((c) => [c.title, c.position]),
      ).toEqual([
        ['Dois b', 1],
        ['Três', 2],
      ]);
    });

    it('capítulo de outro plano ou inexistente responde 404', async () => {
      const a = await createPlan(teacherA.token);
      const b = await createPlan(teacherA.token);
      const chapter = (await addChapter(teacherA.token, b.id, 'Do B'))
        .chapters[0];
      const bearer = as(teacherA.token);
      for (const id of [chapter.id, 999999]) {
        const { body } = await http()
          .put(`/api/v1/plans/${a.id}/chapters/${id}`)
          .set(bearer)
          .send({ title: 'X' })
          .expect(404);
        expect(body.message).toBe('Capítulo não encontrado.');
        await http()
          .delete(`/api/v1/plans/${a.id}/chapters/${id}`)
          .set(bearer)
          .expect(404);
      }
    });

    it('reordena numa transação sem violar o único de posição', async () => {
      const plan = await createPlan(teacherA.token);
      await addChapter(teacherA.token, plan.id, 'Um');
      await addChapter(teacherA.token, plan.id, 'Dois');
      const three = await addChapter(teacherA.token, plan.id, 'Três');
      const [one, two, tre] = three.chapters.map((c) => c.id);
      const { body } = await http()
        .put(`/api/v1/plans/${plan.id}/chapters/order`)
        .set(as(teacherA.token))
        .send({ chapter_ids: [tre, one, two] })
        .expect(200);
      expect(
        (body as ApiPlan).chapters.map((c) => [c.title, c.position]),
      ).toEqual([
        ['Três', 1],
        ['Um', 2],
        ['Dois', 3],
      ]);
    });

    it('a ordem precisa trazer exatamente os capítulos do plano', async () => {
      const plan = await createPlan(teacherA.token);
      const other = await createPlan(teacherA.token);
      await addChapter(teacherA.token, plan.id, 'Um');
      const two = await addChapter(teacherA.token, plan.id, 'Dois');
      const foreign = (await addChapter(teacherA.token, other.id, 'Alheio'))
        .chapters[0].id;
      const [one, second] = two.chapters.map((c) => c.id);
      const bad = [
        [one],
        [one, one],
        [one, second, foreign],
        [one, foreign],
        [],
      ];
      for (const chapter_ids of bad) {
        const { body } = await http()
          .put(`/api/v1/plans/${plan.id}/chapters/order`)
          .set(as(teacherA.token))
          .send({ chapter_ids })
          .expect(422);
        expect(body.errors).toHaveProperty('chapter_ids');
      }
      await http()
        .put(`/api/v1/plans/${plan.id}/chapters/order`)
        .set(as(teacherA.token))
        .send({ chapter_ids: 'x' })
        .expect(422);
    });

    it('capítulos criados ao mesmo tempo recebem posições distintas', async () => {
      const plan = await createPlan(teacherA.token);
      const responses = await Promise.all(
        ['A', 'B', 'C', 'D'].map((title) =>
          http()
            .post(`/api/v1/plans/${plan.id}/chapters`)
            .set(as(teacherA.token))
            .send({ title: `Capítulo ${title}` }),
        ),
      );
      expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201]);
      const rows = await prisma.planChapter.findMany({
        where: { levelingPlanId: plan.id },
        orderBy: { position: 'asc' },
      });
      expect(rows.map((r) => r.position)).toEqual([1, 2, 3, 4]);
    });
  });

  describe('questões do capítulo', () => {
    it('substitui a lista e a ordem do array vira a posição', async () => {
      const { planId, chapterId, q1, q2 } = await planWithQuestions(
        teacherA.token,
      );
      const category = await createCategory(prisma, { subjectId });
      const q3 = await createQuestion(prisma, {
        subjectId,
        categoryId: category.id,
      });
      const { body } = await setQuestions(teacherA.token, planId, chapterId, [
        q3.id,
        q2.id,
        q1.id,
      ]).expect(200);
      const questions = (body as ApiPlan).chapters[0].questions;
      expect(questions.map((q) => q.id)).toEqual([q3.id, q2.id, q1.id]);
      expect(questions[0]).toHaveProperty('statement_excerpt');
      expect((body as ApiPlan).questions_count).toBe(3);

      const trimmed = await setQuestions(teacherA.token, planId, chapterId, [
        q2.id,
      ]).expect(200);
      expect(
        (trimmed.body as ApiPlan).chapters[0].questions.map((q) => q.id),
      ).toEqual([q2.id]);
    });

    it('questão de outra disciplina, inativa, inexistente ou repetida: 422', async () => {
      const { planId, chapterId } = await planWithQuestions(teacherA.token);
      const otherSubject = await createSubject(prisma);
      const foreign = await createQuestion(prisma, {
        subjectId: otherSubject.id,
      });
      const category = await createCategory(prisma, { subjectId });
      const inactive = await createQuestion(prisma, {
        subjectId,
        categoryId: category.id,
        active: false,
      });
      const active = await createQuestion(prisma, {
        subjectId,
        categoryId: category.id,
      });
      const cases = [
        [foreign.id],
        [inactive.id],
        [999999],
        [active.id, active.id],
      ];
      for (const ids of cases) {
        const { body } = await setQuestions(
          teacherA.token,
          planId,
          chapterId,
          ids,
        ).expect(422);
        expect(body.errors.question_ids).toEqual([QUESTIONS_MESSAGE]);
      }
      await http()
        .put(`/api/v1/plans/${planId}/chapters/${chapterId}/questions`)
        .set(as(teacherA.token))
        .send({ question_ids: 'x' })
        .expect(422);
    });

    it('questão já no capítulo continua valendo depois de desativada', async () => {
      const { planId, chapterId, q1, q2 } = await planWithQuestions(
        teacherA.token,
      );
      await prisma.question.update({
        where: { id: q1.id },
        data: { active: false },
      });
      const { body } = await setQuestions(teacherA.token, planId, chapterId, [
        q2.id,
        q1.id,
      ]).expect(200);
      expect(
        (body as ApiPlan).chapters[0].questions.map((q) => [q.id, q.active]),
      ).toEqual([
        [q2.id, true],
        [q1.id, false],
      ]);
    });
  });

  describe('publicação', () => {
    it('sem capítulos ou com capítulo vazio responde 409; completo publica', async () => {
      const plan = await createPlan(teacherA.token);
      const none = await http()
        .post(`/api/v1/plans/${plan.id}/publish`)
        .set(as(teacherA.token))
        .expect(409);
      expect(none.body.message).toBe(EMPTY_PUBLISH);

      const { planId } = await planWithQuestions(teacherA.token);
      await addChapter(teacherA.token, planId, 'Vazio');
      const empty = await http()
        .post(`/api/v1/plans/${planId}/publish`)
        .set(as(teacherA.token))
        .expect(409);
      expect(empty.body.message).toBe(EMPTY_PUBLISH);

      const ready = await planWithQuestions(teacherA.token);
      const { body } = await http()
        .post(`/api/v1/plans/${ready.planId}/publish`)
        .set(as(teacherA.token))
        .expect(200);
      expect(body.status).toBe('published');
      const row = await prisma.levelingPlan.findUniqueOrThrow({
        where: { id: ready.planId },
      });
      expect(row.publishedAt).not.toBeNull();
    });
  });

  describe('RN08: plano com progresso', () => {
    /** Registra uma tentativa de aluno no capítulo, direto no banco. */
    async function attempt(chapterId: number, questionId: number) {
      const student = await createUser(prisma);
      const option = await prisma.questionOption.findFirstOrThrow({
        where: { questionId, letter: 'A' },
      });
      await prisma.questionAttempt.create({
        data: {
          studentId: student.id,
          questionId,
          planChapterId: chapterId,
          selectedOptionId: option.id,
          attemptNumber: 1,
          isCorrect: true,
        },
      });
    }

    it('remover capítulo ou questão responde 409; adicionar e reordenar continuam permitidos', async () => {
      const { planId, chapterId, q1, q2 } = await planWithQuestions(
        teacherA.token,
      );
      await attempt(chapterId, q1.id);

      const plan = await http()
        .get(`/api/v1/plans/${planId}`)
        .set(as(teacherA.token))
        .expect(200);
      expect(plan.body.has_progress).toBe(true);

      const chapter = await http()
        .delete(`/api/v1/plans/${planId}/chapters/${chapterId}`)
        .set(as(teacherA.token))
        .expect(409);
      expect(chapter.body.message).toBe(HAS_PROGRESS);

      const removal = await setQuestions(teacherA.token, planId, chapterId, [
        q1.id,
      ]).expect(409);
      expect(removal.body.message).toBe(HAS_PROGRESS);

      const category = await createCategory(prisma, { subjectId });
      const q3 = await createQuestion(prisma, {
        subjectId,
        categoryId: category.id,
      });
      const added = await setQuestions(teacherA.token, planId, chapterId, [
        q2.id,
        q1.id,
        q3.id,
      ]).expect(200);
      expect(
        (added.body as ApiPlan).chapters[0].questions.map((q) => q.id),
      ).toEqual([q2.id, q1.id, q3.id]);

      await addChapter(teacherA.token, planId, 'Capítulo 2');
      await http()
        .put(`/api/v1/plans/${planId}`)
        .set(as(teacherA.token))
        .send({ title: 'Renomeado', subject_id: subjectId })
        .expect(200);
      expect(await prisma.chapterQuestion.count()).toBe(3);
    });
  });

  describe('banco', () => {
    it('posições repetidas só quebram no commit (DEFERRABLE) e a lista é única depois', async () => {
      const plan = await createPlan(teacherA.token);
      await addChapter(teacherA.token, plan.id, 'Um');
      await addChapter(teacherA.token, plan.id, 'Dois');
      await expect(
        prisma.planChapter.updateMany({
          where: { levelingPlanId: plan.id },
          data: { position: 1 },
        }),
      ).rejects.toThrow();
    });

    it('questões do capítulo: posição única por capítulo no banco', async () => {
      const { chapterId, q1, q2 } = await planWithQuestions(teacherA.token);
      await expect(
        prisma.chapterQuestion.updateMany({
          where: {
            planChapterId: chapterId,
            questionId: { in: [q1.id, q2.id] },
          },
          data: { position: 1 },
        }),
      ).rejects.toThrow();
    });

    it('tentativa não aponta para capítulo inexistente (FK) e capítulo com tentativa não é apagado', async () => {
      const { chapterId, q1 } = await planWithQuestions(teacherA.token);
      const student = await createUser(prisma);
      const option = await prisma.questionOption.findFirstOrThrow({
        where: { questionId: q1.id, letter: 'A' },
      });
      const data = {
        studentId: student.id,
        questionId: q1.id,
        selectedOptionId: option.id,
        attemptNumber: 1,
        isCorrect: true,
      };
      await expect(
        prisma.questionAttempt.create({
          data: { ...data, planChapterId: 999999 },
        }),
      ).rejects.toThrow();
      await prisma.questionAttempt.create({
        data: { ...data, planChapterId: chapterId },
      });
      await expect(
        prisma.planChapter.delete({ where: { id: chapterId } }),
      ).rejects.toThrow();
    });
  });
});
