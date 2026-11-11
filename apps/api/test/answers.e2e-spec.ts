import { INestApplication } from '@nestjs/common';
import type { ApiAnswerResult } from '@nivela/api-contract';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import { createQuestion } from './helpers/factories';
import { sessionFor, tokenFor } from './helpers/login';
import { resetDatabase } from './helpers/reset-database';

const EXPLANATION = 'Explicação da resposta.';
const FINISHED = 'Você já terminou esta questão.';

describe('Respostas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let studentId: number;

  const server = () => app.getHttpServer();
  const answer = (
    questionId: number,
    letter: string,
    bearer: string = token,
    extra: Record<string, unknown> = {},
  ) =>
    request(server())
      .post('/api/v1/answers')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ question_id: questionId, selected_letter: letter, ...extra });
  const profile = () =>
    prisma.studentProfile.findUniqueOrThrow({ where: { userId: studentId } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const session = await sessionFor(app, Role.Student);
    token = session.token;
    studentId = session.user.id;
  });

  it('acerto na 1ª tentativa: +10 moedas, terminada, com a explicação', async () => {
    const question = await createQuestion(prisma);
    const { body } = await answer(question.id, 'A').expect(200);
    const result = body as ApiAnswerResult;
    expect(result).toMatchObject({
      is_correct: true,
      attempt_number: 1,
      finished: true,
      coins_awarded: 10,
      coins_balance: 10,
      correct_letter: 'A',
      explanation: EXPLANATION,
      streak: { current: 1, best: 1, bonus_awarded: 0 },
    });
    expect((await profile()).coinsBalance).toBe(10);
  });

  it('erro na 1ª tentativa: não termina e não revela a correta nem a explicação (RN05)', async () => {
    const question = await createQuestion(prisma);
    const { body, text } = await answer(question.id, 'B').expect(200);
    expect(body).toMatchObject({
      is_correct: false,
      attempt_number: 1,
      finished: false,
      coins_awarded: 0,
      coins_balance: 0,
      correct_letter: null,
      explanation: null,
    });
    expect(text).not.toContain(EXPLANATION);
  });

  it('acerto na 2ª tentativa rende 5 moedas', async () => {
    const question = await createQuestion(prisma);
    await answer(question.id, 'B').expect(200);
    const { body } = await answer(question.id, 'A').expect(200);
    expect(body).toMatchObject({
      is_correct: true,
      attempt_number: 2,
      finished: true,
      coins_awarded: 5,
      coins_balance: 5,
      correct_letter: 'A',
      explanation: EXPLANATION,
    });
  });

  it('erro na 2ª tentativa termina a questão e revela a correta e a explicação', async () => {
    const question = await createQuestion(prisma);
    await answer(question.id, 'B').expect(200);
    const { body } = await answer(question.id, 'C').expect(200);
    expect(body).toMatchObject({
      is_correct: false,
      attempt_number: 2,
      finished: true,
      coins_awarded: 0,
      correct_letter: 'A',
      explanation: EXPLANATION,
    });
  });

  it('a 3ª chamada (depois de esgotar as tentativas) responde 409', async () => {
    const question = await createQuestion(prisma);
    await answer(question.id, 'B').expect(200);
    await answer(question.id, 'C').expect(200);
    const { body } = await answer(question.id, 'A').expect(409);
    expect(body).toMatchObject({ message: FINISHED });
    expect(await prisma.questionAttempt.count()).toBe(2);
  });

  it('responder de novo depois de acertar responde 409 e não paga outra vez', async () => {
    const question = await createQuestion(prisma);
    await answer(question.id, 'A').expect(200);
    const { body } = await answer(question.id, 'A').expect(409);
    expect(body).toMatchObject({ message: FINISHED });
    expect((await profile()).coinsBalance).toBe(10);
  });

  it('duas respostas certas simultâneas: uma passa, a outra recebe 409 e as moedas entram uma vez (RN04)', async () => {
    const question = await createQuestion(prisma);
    const responses = await Promise.all([
      answer(question.id, 'A'),
      answer(question.id, 'A'),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const loser = responses.find((r) => r.status === 409);
    expect(loser?.body).toMatchObject({ message: FINISHED });
    expect(await prisma.questionAttempt.count()).toBe(1);
    expect((await profile()).coinsBalance).toBe(10);
  });

  it('duas respostas erradas simultâneas viram a 1ª e a 2ª tentativa, sem se atropelar', async () => {
    const question = await createQuestion(prisma);
    const responses = await Promise.all([
      answer(question.id, 'B'),
      answer(question.id, 'C'),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    const numbers = responses
      .map((r) => (r.body as ApiAnswerResult).attempt_number)
      .sort();
    expect(numbers).toEqual([1, 2]);
    expect(await prisma.questionAttempt.count()).toBe(2);
  });

  it('o saldo bate com a soma do extrato', async () => {
    const q1 = await createQuestion(prisma);
    const q2 = await createQuestion(prisma);
    const q3 = await createQuestion(prisma);
    await answer(q1.id, 'A').expect(200);
    await answer(q2.id, 'B').expect(200);
    await answer(q2.id, 'A').expect(200);
    await answer(q3.id, 'B').expect(200);
    await answer(q3.id, 'B').expect(200);
    const sum = await prisma.coinTransaction.aggregate({
      where: { studentId },
      _sum: { amount: true },
    });
    expect(sum._sum.amount).toBe(15);
    expect((await profile()).coinsBalance).toBe(15);
    const attempts = await prisma.questionAttempt.findMany({
      where: { studentId },
      orderBy: { id: 'asc' },
    });
    expect(attempts.map((a) => a.coinsAwarded)).toEqual([10, 0, 5, 0, 0]);
  });

  it('atualiza a sequência de estudo (visível em /me/stats)', async () => {
    const question = await createQuestion(prisma);
    await answer(question.id, 'B').expect(200);
    const { body } = await request(server())
      .get('/api/v1/me/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(body).toEqual({
      coins_balance: 0,
      current_streak: 1,
      best_streak: 1,
    });
    const second = await createQuestion(prisma);
    await answer(second.id, 'A').expect(200);
    const after = await request(server())
      .get('/api/v1/me/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(after.body).toEqual({
      coins_balance: 10,
      current_streak: 1,
      best_streak: 1,
    });
  });

  it('questão inativa ou inexistente responde 404', async () => {
    const inactive = await createQuestion(prisma, { active: false });
    for (const id of [inactive.id, 999999]) {
      const { body } = await answer(id, 'A').expect(404);
      expect(body).toMatchObject({ message: 'Questão não encontrada.' });
    }
    expect(await prisma.questionAttempt.count()).toBe(0);
  });

  it('valida o corpo: letra e questão (422)', async () => {
    const question = await createQuestion(prisma);
    const badLetter = await answer(question.id, 'Z').expect(422);
    expect(badLetter.body.errors).toHaveProperty('selected_letter');
    const missing = await request(server())
      .post('/api/v1/answers')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(422);
    expect(missing.body.errors).toHaveProperty('question_id');
    expect(missing.body.errors).toHaveProperty('selected_letter');
  });

  it('plan_chapter_id de capítulo que não existe responde 404', async () => {
    const question = await createQuestion(prisma);
    const { body } = await answer(question.id, 'A', token, {
      plan_chapter_id: 1,
    }).expect(404);
    expect(body.message).toBe('Capítulo não encontrado.');
    expect(await prisma.questionAttempt.count()).toBe(0);
  });

  it('plan_chapter_id nulo vale como prática livre', async () => {
    const question = await createQuestion(prisma);
    const { body } = await answer(question.id, 'A', token, {
      plan_chapter_id: null,
    }).expect(200);
    expect(body).toMatchObject({ is_correct: true, coins_awarded: 10 });
    const attempt = await prisma.questionAttempt.findFirstOrThrow();
    expect(attempt.planChapterId).toBeNull();
  });

  it('só o aluno responde: equipe recebe 403 e anônimo 401', async () => {
    const question = await createQuestion(prisma);
    for (const role of [Role.Teacher, Role.Admin]) {
      await answer(question.id, 'A', await tokenFor(app, role)).expect(403);
    }
    await request(server())
      .post('/api/v1/answers')
      .send({ question_id: question.id, selected_letter: 'A' })
      .expect(401);
    await request(server())
      .get('/api/v1/me/stats')
      .set('Authorization', `Bearer ${await tokenFor(app, Role.Teacher)}`)
      .expect(403);
  });
});
