import { INestApplication } from '@nestjs/common';
import type {
  ApiList,
  ApiPracticeNext,
  ApiPracticeSubject,
} from '@nivela/api-contract';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import {
  createCategory,
  createQuestion,
  createSubject,
} from './helpers/factories';
import { tokenFor } from './helpers/login';
import { resetDatabase } from './helpers/reset-database';

const LEAK = /correct_letter|is_correct|isCorrect|explanation|Explicação/;

describe('Prática livre (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  const server = () => app.getHttpServer();
  const get = (path: string, bearer: string = token) =>
    request(server())
      .get(`/api/v1${path}`)
      .set('Authorization', `Bearer ${bearer}`);
  const answer = (questionId: number, letter: string) =>
    request(server())
      .post('/api/v1/answers')
      .set('Authorization', `Bearer ${token}`)
      .send({ question_id: questionId, selected_letter: letter });
  const next = async (query: string) =>
    (await get(`/practice/next?${query}`).expect(200)).body as ApiPracticeNext;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    token = await tokenFor(app, Role.Student);
  });

  describe('GET /practice/subjects', () => {
    it('lista só disciplinas e categorias com questões ativas, com a contagem', async () => {
      const math = await createSubject(prisma, { name: 'Matemática' });
      const algebra = await createCategory(prisma, {
        subjectId: math.id,
        name: 'Álgebra',
      });
      const geometry = await createCategory(prisma, {
        subjectId: math.id,
        name: 'Geometria',
      });
      await createCategory(prisma, { subjectId: math.id, name: 'Vazia' });
      await createQuestion(prisma, { categoryId: algebra.id });
      await createQuestion(prisma, { categoryId: algebra.id });
      await createQuestion(prisma, { categoryId: geometry.id, active: false });
      const onlyInactive = await createSubject(prisma, { name: 'Inativa' });
      await createQuestion(prisma, {
        subjectId: onlyInactive.id,
        active: false,
      });
      await createSubject(prisma, { name: 'Sem questões' });

      const { body } = await get('/practice/subjects').expect(200);
      const list = (body as ApiList<ApiPracticeSubject>).data;
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        id: math.id,
        name: 'Matemática',
        color: 'teal',
        icon: 'book',
        available_questions: 2,
        categories: [
          { id: algebra.id, name: 'Álgebra', available_questions: 2 },
        ],
      });
    });

    it('a contagem desconta as questões que o aluno já terminou na prática', async () => {
      const category = await createCategory(prisma);
      const done = await createQuestion(prisma, { categoryId: category.id });
      const retry = await createQuestion(prisma, { categoryId: category.id });
      await createQuestion(prisma, { categoryId: category.id });
      await answer(done.id, 'A').expect(200);
      await answer(retry.id, 'B').expect(200); // ainda não terminou

      const { body } = await get('/practice/subjects').expect(200);
      const [subject] = (body as ApiList<ApiPracticeSubject>).data;
      expect(subject.available_questions).toBe(2);
      expect(subject.categories[0].available_questions).toBe(2);
    });

    it('só o aluno acessa (equipe 403)', async () => {
      await get('/practice/subjects', await tokenFor(app, Role.Teacher)).expect(
        403,
      );
      await request(server()).get('/api/v1/practice/subjects').expect(401);
    });
  });

  describe('GET /practice/next', () => {
    it('traz a menor id ativa e nunca vaza a correta nem a explicação (RN05)', async () => {
      const subject = await createSubject(prisma);
      const first = await createQuestion(prisma, { subjectId: subject.id });
      await createQuestion(prisma, { subjectId: subject.id });
      const { body, text } = await get(
        `/practice/next?subject_id=${subject.id}`,
      ).expect(200);
      const result = body as ApiPracticeNext;
      expect(result.remaining).toBe(2);
      expect(result.question).toMatchObject({
        id: first.id,
        image_url: null,
        difficulty: 'medium',
        subject: { id: subject.id, color: 'teal' },
        attempts_left: 2,
      });
      expect(result.question?.options).toEqual(
        ['A', 'B', 'C', 'D', 'E'].map((letter) => ({
          letter,
          text: `Alternativa ${letter}`,
        })),
      );
      expect(text).not.toMatch(LEAK);
    });

    it('depois de um erro mostra attempts_left 1, ainda sem vazar nada', async () => {
      const subject = await createSubject(prisma);
      const question = await createQuestion(prisma, { subjectId: subject.id });
      await answer(question.id, 'B').expect(200);
      const { body, text } = await get(
        `/practice/next?subject_id=${subject.id}`,
      ).expect(200);
      expect((body as ApiPracticeNext).question).toMatchObject({
        id: question.id,
        attempts_left: 1,
      });
      expect(text).not.toMatch(LEAK);
    });

    it('pula as terminadas, ignora as inativas e acaba em question: null', async () => {
      const subject = await createSubject(prisma);
      const q1 = await createQuestion(prisma, { subjectId: subject.id });
      await createQuestion(prisma, { subjectId: subject.id, active: false });
      const q3 = await createQuestion(prisma, { subjectId: subject.id });
      const query = `subject_id=${subject.id}`;

      await answer(q1.id, 'A').expect(200);
      expect(await next(query)).toMatchObject({
        remaining: 1,
        question: { id: q3.id },
      });

      await answer(q3.id, 'B').expect(200);
      await answer(q3.id, 'B').expect(200); // esgotou as 2 tentativas
      expect(await next(query)).toEqual({ question: null, remaining: 0 });
    });

    it('filtra por categoria e trata parâmetro vazio como ausente', async () => {
      const subject = await createSubject(prisma);
      const a = await createCategory(prisma, { subjectId: subject.id });
      const b = await createCategory(prisma, { subjectId: subject.id });
      await createQuestion(prisma, { categoryId: a.id });
      const inB = await createQuestion(prisma, { categoryId: b.id });
      expect(
        await next(`subject_id=${subject.id}&category_id=${b.id}`),
      ).toMatchObject({ remaining: 1, question: { id: inB.id } });
      expect(
        (await next(`subject_id=${subject.id}&category_id=`)).remaining,
      ).toBe(2);
    });

    it('subject_id obrigatório (422), disciplina ou categoria inexistente (404)', async () => {
      const missing = await get('/practice/next').expect(422);
      expect(missing.body.errors.subject_id).toEqual([
        'Escolha uma disciplina.',
      ]);
      await get('/practice/next?subject_id=').expect(422);
      await get('/practice/next?subject_id=abc').expect(422);
      const none = await get('/practice/next?subject_id=999999').expect(404);
      expect(none.body).toMatchObject({
        message: 'Disciplina não encontrada.',
      });

      const subject = await createSubject(prisma);
      const other = await createCategory(prisma);
      const wrong = await get(
        `/practice/next?subject_id=${subject.id}&category_id=${other.id}`,
      ).expect(404);
      expect(wrong.body).toMatchObject({
        message: 'Categoria não encontrada.',
      });
    });

    it('só o aluno acessa (equipe 403)', async () => {
      const subject = await createSubject(prisma);
      await get(
        `/practice/next?subject_id=${subject.id}`,
        await tokenFor(app, Role.Admin),
      ).expect(403);
    });
  });
});
