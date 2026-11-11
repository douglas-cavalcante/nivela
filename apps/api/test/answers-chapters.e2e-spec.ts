import { INestApplication } from '@nestjs/common';
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

const LOCKED = 'Conclua o capítulo anterior para liberar este.';
const FINISHED = 'Você já terminou esta questão.';

describe('Respostas em capítulos de plano (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let teacherId: number;
  let subjectId: number;
  let student: Awaited<ReturnType<typeof sessionFor>>;

  const answer = (
    questionId: number,
    letter: string,
    chapterId?: number,
    token = student.token,
  ) =>
    request(app.getHttpServer())
      .post('/api/v1/answers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        question_id: questionId,
        selected_letter: letter,
        ...(chapterId === undefined ? {} : { plan_chapter_id: chapterId }),
      });
  const balance = async () =>
    (
      await prisma.studentProfile.findUniqueOrThrow({
        where: { userId: student.user.id },
      })
    ).coinsBalance;
  const ledgerSum = async () =>
    (
      await prisma.coinTransaction.aggregate({
        where: { studentId: student.user.id },
        _sum: { amount: true },
      })
    )._sum.amount ?? 0;
  const assign = (planId: number, studentId = student.user.id) =>
    prisma.planAssignment.create({
      data: { levelingPlanId: planId, studentId },
    });
  const plan = (chapters: number[], completionBonus = 50) =>
    createPlan(prisma, { teacherId, subjectId, chapters, completionBonus });

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

  describe('acesso ao capítulo', () => {
    it('capítulo trancado → 409 sem gravar; liberado ao concluir o anterior', async () => {
      const { planId, chapters } = await plan([1, 1]);
      await assign(planId);
      const locked = await answer(
        chapters[1].questions[0],
        'A',
        chapters[1].id,
      ).expect(409);
      expect(locked.body.message).toBe(LOCKED);
      expect(await prisma.questionAttempt.count()).toBe(0);

      await answer(chapters[0].questions[0], 'A', chapters[0].id).expect(200);
      await answer(chapters[1].questions[0], 'A', chapters[1].id).expect(200);
    });

    it('capítulo de plano não atribuído, de rascunho ou inexistente → 404', async () => {
      const hidden = await plan([1]);
      const draft = await createPlan(prisma, {
        teacherId,
        subjectId,
        chapters: [1],
        status: 'draft',
      });
      await assign(draft.planId);
      const otherClassroom = await createClassroom(prisma, { teacherId });
      await prisma.planAssignment.create({
        data: { levelingPlanId: hidden.planId, classroomId: otherClassroom.id },
      });
      for (const target of [hidden.chapters[0], draft.chapters[0]]) {
        const { body } = await answer(
          target.questions[0],
          'A',
          target.id,
        ).expect(404);
        expect(body.message).toBe('Capítulo não encontrado.');
      }
      const missing = await answer(
        hidden.chapters[0].questions[0],
        'A',
        999999,
      );
      expect(missing.status).toBe(404);
      expect(await prisma.questionAttempt.count()).toBe(0);
    });

    it('questão de fora do capítulo → 404 "Questão não encontrada."', async () => {
      const { planId, chapters } = await plan([1, 1]);
      await assign(planId);
      const outsider = await createQuestion(prisma, { subjectId });
      for (const questionId of [outsider.id, chapters[1].questions[0]]) {
        const { body } = await answer(questionId, 'A', chapters[0].id).expect(
          404,
        );
        expect(body.message).toBe('Questão não encontrada.');
      }
      expect(await prisma.questionAttempt.count()).toBe(0);
    });

    it('questão desativada → 404 mesmo dentro do capítulo', async () => {
      const { planId, chapters } = await plan([2]);
      await assign(planId);
      await prisma.question.update({
        where: { id: chapters[0].questions[0] },
        data: { active: false },
      });
      await answer(chapters[0].questions[0], 'A', chapters[0].id).expect(404);
    });
  });

  describe('tentativas no contexto do capítulo (Review Focus 1 e 3)', () => {
    it('erro na 1ª não revela a correta; erro na 2ª termina; 3ª → 409', async () => {
      const { planId, chapters } = await plan([2]);
      await assign(planId);
      const [q1] = chapters[0].questions;
      const first = await answer(q1, 'B', chapters[0].id).expect(200);
      expect(first.body).toMatchObject({
        is_correct: false,
        finished: false,
        correct_letter: null,
        explanation: null,
        coins_awarded: 0,
      });
      expect(first.body.chapter).toEqual({
        completed: false,
        next_chapter_id: null,
      });
      expect(first.body.plan).toEqual({ completed: false, bonus_awarded: 0 });
      const second = await answer(q1, 'C', chapters[0].id).expect(200);
      expect(second.body).toMatchObject({
        finished: true,
        correct_letter: 'A',
        explanation: 'Explicação da resposta.',
      });
      const third = await answer(q1, 'A', chapters[0].id).expect(409);
      expect(third.body.message).toBe(FINISHED);
    });

    it('prática e capítulo têm tentativas independentes', async () => {
      const { planId, chapters } = await plan([1]);
      await assign(planId);
      const [q1] = chapters[0].questions;
      await answer(q1, 'B').expect(200);
      await answer(q1, 'C').expect(200);
      await answer(q1, 'A').expect(409);
      const inChapter = await answer(q1, 'B', chapters[0].id).expect(200);
      expect(inChapter.body.attempt_number).toBe(1);
    });
  });

  describe('moedas (Review Focus 2, RN04)', () => {
    it('acertar no capítulo questão já acertada na prática: 0 moedas, mas conta para o capítulo', async () => {
      const { planId, chapters } = await plan([1, 1], 50);
      await assign(planId);
      const [q1] = chapters[0].questions;
      const practice = await answer(q1, 'A').expect(200);
      expect(practice.body.coins_awarded).toBe(10);

      const inChapter = await answer(q1, 'A', chapters[0].id).expect(200);
      expect(inChapter.body).toMatchObject({
        is_correct: true,
        coins_awarded: 0,
        coins_balance: 10,
      });
      expect(inChapter.body.chapter).toEqual({
        completed: true,
        next_chapter_id: chapters[1].id,
      });
      expect(await prisma.chapterCompletion.count()).toBe(1);
      expect(await balance()).toBe(10);
      expect(await ledgerSum()).toBe(10);
    });

    it('acerto no capítulo credita 10 e depois a prática não credita de novo', async () => {
      const { planId, chapters } = await plan([1]);
      await assign(planId);
      const [q1] = chapters[0].questions;
      const first = await answer(q1, 'A', chapters[0].id).expect(200);
      expect(first.body.coins_awarded).toBe(10);
      const practice = await answer(q1, 'A').expect(200);
      expect(practice.body.coins_awarded).toBe(0);
      expect(
        await prisma.coinTransaction.count({
          where: { reason: 'correct_answer' },
        }),
      ).toBe(1);
    });
  });

  describe('conclusão de capítulos e do plano (RN06, RN07)', () => {
    it('concluir o capítulo libera o próximo; concluir o último paga o bônus uma única vez', async () => {
      const { planId, chapters } = await plan([2, 1], 50);
      await assign(planId);
      const [c1, c2] = chapters;

      const a = await answer(c1.questions[0], 'A', c1.id).expect(200);
      expect(a.body.chapter.completed).toBe(false);
      const b = await answer(c1.questions[1], 'A', c1.id).expect(200);
      expect(b.body.chapter).toEqual({
        completed: true,
        next_chapter_id: c2.id,
      });
      expect(b.body.plan).toEqual({ completed: false, bonus_awarded: 0 });

      const last = await answer(c2.questions[0], 'A', c2.id).expect(200);
      expect(last.body.chapter).toEqual({
        completed: true,
        next_chapter_id: null,
      });
      expect(last.body.plan).toEqual({ completed: true, bonus_awarded: 50 });
      expect(last.body.coins_awarded).toBe(10);
      expect(last.body.coins_balance).toBe(80);
      expect(await balance()).toBe(80);
      expect(await ledgerSum()).toBe(80);
      expect(
        await prisma.coinTransaction.findMany({
          where: { reason: 'plan_completed' },
        }),
      ).toEqual([
        expect.objectContaining({
          studentId: student.user.id,
          amount: 50,
          sourceType: 'plan',
          sourceId: planId,
        }),
      ]);
      const completion = await prisma.planCompletion.findFirstOrThrow();
      expect(completion.bonusAwarded).toBe(50);

      // Repetir não credita nem duplica.
      await answer(c2.questions[0], 'A', c2.id).expect(409);
      expect(await prisma.planCompletion.count()).toBe(1);
      expect(await balance()).toBe(80);
    });

    it('capítulo novo depois da conclusão do plano: o bônus não se repete', async () => {
      const { planId, chapters } = await plan([1], 50);
      await assign(planId);
      await answer(chapters[0].questions[0], 'A', chapters[0].id).expect(200);
      expect(await balance()).toBe(60);

      const added = await prisma.planChapter.create({
        data: { levelingPlanId: planId, title: 'Extra', position: 2 },
      });
      const extra = await createQuestion(prisma, { subjectId });
      await prisma.chapterQuestion.create({
        data: { planChapterId: added.id, questionId: extra.id, position: 1 },
      });
      const result = await answer(extra.id, 'A', added.id).expect(200);
      expect(result.body.chapter.completed).toBe(true);
      expect(result.body.plan).toEqual({ completed: true, bonus_awarded: 0 });
      expect(await prisma.planCompletion.count()).toBe(1);
      expect(
        await prisma.coinTransaction.count({
          where: { reason: 'plan_completed' },
        }),
      ).toBe(1);
      expect(await balance()).toBe(70);
      expect(await ledgerSum()).toBe(70);
    });

    it('questão terminada com 2 erros também conta para concluir o capítulo', async () => {
      const { planId, chapters } = await plan([1]);
      await assign(planId);
      const [q1] = chapters[0].questions;
      await answer(q1, 'B', chapters[0].id).expect(200);
      const second = await answer(q1, 'B', chapters[0].id).expect(200);
      expect(second.body.chapter.completed).toBe(true);
      expect(second.body.plan).toEqual({ completed: true, bonus_awarded: 50 });
    });

    it('questão desativada depois de entrar no capítulo não trava a conclusão', async () => {
      const { planId, chapters } = await plan([2]);
      await assign(planId);
      const [q1, q2] = chapters[0].questions;
      await prisma.question.update({
        where: { id: q2 },
        data: { active: false },
      });
      const { body } = await answer(q1, 'A', chapters[0].id).expect(200);
      expect(body.chapter.completed).toBe(true);
      expect(body.plan.completed).toBe(true);
    });

    it('Ruling 4: capítulo sem questões ativas no meio não trava o plano', async () => {
      const { planId, chapters } = await plan([1, 1, 1]);
      await assign(planId);
      await prisma.question.update({
        where: { id: chapters[1].questions[0] },
        data: { active: false },
      });
      const first = await answer(
        chapters[0].questions[0],
        'A',
        chapters[0].id,
      ).expect(200);
      expect(first.body.chapter.next_chapter_id).toBe(chapters[1].id);
      // O capítulo 2 (vazio) já conta como concluído: o 3 está liberado.
      const last = await answer(
        chapters[2].questions[0],
        'A',
        chapters[2].id,
      ).expect(200);
      expect(last.body.plan).toEqual({ completed: true, bonus_awarded: 50 });
    });

    it('respostas simultâneas que fecham o plano pagam o bônus uma vez; saldo = extrato', async () => {
      const { planId, chapters } = await plan([2], 50);
      await assign(planId);
      const [q1, q2] = chapters[0].questions;
      const results = await Promise.all([
        answer(q1, 'A', chapters[0].id),
        answer(q2, 'A', chapters[0].id),
      ]);
      expect(results.map((r) => r.status)).toEqual([200, 200]);
      expect(
        await prisma.coinTransaction.count({
          where: { reason: 'plan_completed' },
        }),
      ).toBe(1);
      expect(await prisma.planCompletion.count()).toBe(1);
      expect(await balance()).toBe(70);
      expect(await ledgerSum()).toBe(70);
    });

    const getPlan = (planId: number) =>
      request(app.getHttpServer())
        .get(`/api/v1/me/plans/${planId}`)
        .set('Authorization', `Bearer ${student.token}`);

    it('Ruling 6: questão desativada depois de terminar as outras: GET do plano assenta o capítulo e libera o próximo', async () => {
      const { planId, chapters } = await plan([2, 1]);
      await assign(planId);
      const [q1, q2] = chapters[0].questions;
      await answer(q1, 'A', chapters[0].id).expect(200);
      await prisma.question.update({
        where: { id: q2 },
        data: { active: false },
      });
      const { body } = await getPlan(planId).expect(200);
      expect(body.chapters.map((c: { state: string }) => c.state)).toEqual([
        'completed',
        'available',
      ]);
      expect(
        await prisma.chapterCompletion.count({
          where: { planChapterId: chapters[0].id },
        }),
      ).toBe(1);
      await answer(chapters[1].questions[0], 'A', chapters[1].id).expect(200);
    });

    it('Ruling 6: último capítulo esvaziado depois do anterior concluído: plano concluído e bônus uma vez, mesmo com GETs repetidos', async () => {
      const { planId, chapters } = await plan([1, 1], 50);
      await assign(planId);
      await answer(chapters[0].questions[0], 'A', chapters[0].id).expect(200);
      await prisma.question.update({
        where: { id: chapters[1].questions[0] },
        data: { active: false },
      });
      for (let i = 0; i < 3; i++) {
        const { body } = await getPlan(planId).expect(200);
        expect(body.completed).toBe(true);
      }
      expect(await prisma.planCompletion.count()).toBe(1);
      expect(
        await prisma.coinTransaction.count({
          where: { reason: 'plan_completed' },
        }),
      ).toBe(1);
      expect(await balance()).toBe(60);
      expect(await ledgerSum()).toBe(60);
    });

    it('Ruling 6: next sem questão restante assenta a conclusão pendente', async () => {
      const { planId, chapters } = await plan([2]);
      await assign(planId);
      const [q1, q2] = chapters[0].questions;
      await answer(q1, 'A', chapters[0].id).expect(200);
      await prisma.question.update({
        where: { id: q2 },
        data: { active: false },
      });
      const { body } = await request(app.getHttpServer())
        .get(`/api/v1/me/plans/${planId}/chapters/${chapters[0].id}/next`)
        .set('Authorization', `Bearer ${student.token}`)
        .expect(200);
      expect(body).toEqual({ question: null, remaining: 0 });
      expect(await prisma.chapterCompletion.count()).toBe(1);
      expect(await prisma.planCompletion.count()).toBe(1);
      expect(await balance()).toBe(60);
    });

    it('Ruling 7: questão adicionada a capítulo já concluído é respondível, sem novo bônus', async () => {
      const { planId, chapters } = await plan([1], 50);
      await assign(planId);
      await answer(chapters[0].questions[0], 'A', chapters[0].id).expect(200);
      const extra = await createQuestion(prisma, { subjectId });
      await prisma.chapterQuestion.create({
        data: {
          planChapterId: chapters[0].id,
          questionId: extra.id,
          position: 2,
        },
      });
      const result = await answer(extra.id, 'A', chapters[0].id).expect(200);
      expect(result.body.coins_awarded).toBe(10);
      expect(result.body.plan).toEqual({ completed: true, bonus_awarded: 0 });
      expect(await prisma.planCompletion.count()).toBe(1);
      expect(
        await prisma.coinTransaction.count({
          where: { reason: 'plan_completed' },
        }),
      ).toBe(1);
      expect(await balance()).toBe(70);
    });

    it('/me/plans reflete a conclusão', async () => {
      const { planId, chapters } = await plan([1]);
      await assign(planId);
      await answer(chapters[0].questions[0], 'A', chapters[0].id).expect(200);
      const { body } = await request(app.getHttpServer())
        .get('/api/v1/me/plans')
        .set('Authorization', `Bearer ${student.token}`)
        .expect(200);
      expect(body.data[0]).toMatchObject({
        completed: true,
        progress: { completed_chapters: 1, total_chapters: 1, percent: 100 },
      });
    });
  });
});
