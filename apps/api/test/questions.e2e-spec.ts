import { INestApplication } from '@nestjs/common';
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
import { tokenFor } from './helpers/login';
import { resetDatabase } from './helpers/reset-database';
import { createUploadsDir, removeUploadsDir } from './helpers/uploads';

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

describe('Questões (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploads: string;
  let teacher: string;
  let subjectId: number;
  let categoryId: number;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const payload = (overrides: Record<string, unknown> = {}) => ({
    subject_id: subjectId,
    category_id: categoryId,
    statement: 'Quanto é 2 + 2 no sistema decimal?',
    difficulty: 'easy',
    explanation: 'Somando dois com dois obtemos quatro.',
    options: LETTERS.map((letter) => ({ letter, text: `Resposta ${letter}` })),
    correct_letter: 'B',
    ...overrides,
  });
  const create = (token: string, body: Record<string, unknown> = payload()) =>
    http().post('/api/v1/questions').set(as(token)).send(body);

  async function loginAs(email: string): Promise<string> {
    const { body } = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: DEFAULT_PASSWORD, channel: 'web' })
      .expect(200);
    return body.token as string;
  }

  beforeAll(async () => {
    uploads = await createUploadsDir();
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    teacher = await tokenFor(app, Role.Teacher);
    const subject = await createSubject(prisma, { name: 'Matemática' });
    const category = await createCategory(prisma, {
      subjectId: subject.id,
      name: 'Aritmética',
    });
    subjectId = subject.id;
    categoryId = category.id;
  });

  afterAll(async () => {
    await app.close();
    await removeUploadsDir(uploads);
  });

  describe('POST /questions', () => {
    it('cria a questão com as alternativas ordenadas de A a E e a correta marcada', async () => {
      // Alternativas enviadas fora de ordem: voltam ordenadas.
      const options = [...LETTERS]
        .reverse()
        .map((letter) => ({ letter, text: `  Resposta ${letter}  ` }));
      const res = await create(teacher, payload({ options })).expect(201);

      expect(res.body).toEqual({
        id: expect.any(Number),
        statement: 'Quanto é 2 + 2 no sistema decimal?',
        explanation: 'Somando dois com dois obtemos quatro.',
        image_url: null,
        difficulty: 'easy',
        active: true,
        subject: { id: subjectId, name: 'Matemática', color: 'teal' },
        category: { id: categoryId, name: 'Aritmética' },
        author: { id: expect.any(Number), name: expect.any(String) },
        correct_letter: 'B',
        options: LETTERS.map((letter) => ({
          letter,
          text: `Resposta ${letter}`,
        })),
        can_edit: true,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
      const stored = await prisma.questionOption.findMany({
        where: { questionId: res.body.id },
        orderBy: { letter: 'asc' },
      });
      expect(stored.map((o) => o.isCorrect)).toEqual([
        false,
        true,
        false,
        false,
        false,
      ]);
    });

    it('o autor é o usuário logado', async () => {
      const admin = await createUser(prisma, {
        role: Role.Admin,
        name: 'Ana Admin',
      });
      const token = await loginAs(admin.email);
      const res = await create(token).expect(201);
      expect(res.body.author).toEqual({ id: admin.id, name: 'Ana Admin' });
    });

    it('enunciado e explicação fora do tamanho → 422 nos campos', async () => {
      const res = await create(
        teacher,
        payload({ statement: '  curto  ', explanation: '   ' }),
      ).expect(422);
      expect(res.body.errors.statement).toEqual([
        'O enunciado deve ter pelo menos 10 caracteres.',
      ]);
      expect(res.body.errors.explanation).toEqual(['Informe a explicação.']);

      const long = await create(
        teacher,
        payload({ statement: 'a'.repeat(5001), explanation: 'b'.repeat(5001) }),
      ).expect(422);
      expect(long.body.errors.statement).toEqual([
        'O enunciado deve ter no máximo 5000 caracteres.',
      ]);
      expect(long.body.errors.explanation).toEqual([
        'A explicação deve ter no máximo 5000 caracteres.',
      ]);
      expect(await prisma.question.count()).toBe(0);
    });

    it.each([
      ['menos de 5 alternativas', (o: unknown[]) => o.slice(0, 4)],
      ['mais de 5 alternativas', (o: unknown[]) => [...o, o[0]]],
      [
        'letra repetida',
        (o: Array<{ letter: string; text: string }>) =>
          o.map((x, i) => (i === 4 ? { ...x, letter: 'A' } : x)),
      ],
      [
        'letra fora de A–E',
        (o: Array<{ letter: string; text: string }>) =>
          o.map((x, i) => (i === 4 ? { ...x, letter: 'F' } : x)),
      ],
    ])('%s → 422 em "options" e nada gravado', async (_name, mutate) => {
      const base = LETTERS.map((letter) => ({ letter, text: `T${letter}` }));
      const res = await create(
        teacher,
        payload({ options: mutate(base as never) }),
      ).expect(422);
      expect(res.body.errors.options).toEqual([
        'Informe as 5 alternativas, de A a E.',
      ]);
      expect(await prisma.question.count()).toBe(0);
      expect(await prisma.questionOption.count()).toBe(0);
    });

    it('options ausente ou não-lista → 422 em "options"', async () => {
      const missing = await create(teacher, {
        ...payload(),
        options: undefined,
      }).expect(422);
      expect(missing.body.errors.options).toEqual([
        'Informe as 5 alternativas, de A a E.',
      ]);
      const text = await create(teacher, payload({ options: 'abc' })).expect(
        422,
      );
      expect(text.body.errors.options).toEqual([
        'Informe as 5 alternativas, de A a E.',
      ]);
    });

    it('texto de alternativa vazio → 422 em "options.<i>.text"', async () => {
      const options = LETTERS.map((letter, i) => ({
        letter,
        text: i === 2 || i === 4 ? '   ' : `Resposta ${letter}`,
      }));
      const res = await create(teacher, payload({ options })).expect(422);
      expect(res.body.errors['options.2.text']).toEqual([
        'Informe o texto da alternativa.',
      ]);
      expect(res.body.errors['options.4.text']).toEqual([
        'Informe o texto da alternativa.',
      ]);
      expect(res.body.errors.options).toBeUndefined();
      expect(await prisma.question.count()).toBe(0);
    });

    it('correct_letter fora de A–E ou ausente → 422', async () => {
      const bad = await create(
        teacher,
        payload({ correct_letter: 'F' }),
      ).expect(422);
      expect(bad.body.errors.correct_letter).toEqual([
        'Escolha a alternativa correta.',
      ]);
      const missing = await create(teacher, {
        ...payload(),
        correct_letter: undefined,
      }).expect(422);
      expect(missing.body.errors.correct_letter).toEqual([
        'Escolha a alternativa correta.',
      ]);
    });

    it('dificuldade inválida → 422', async () => {
      const res = await create(
        teacher,
        payload({ difficulty: 'impossivel' }),
      ).expect(422);
      expect(res.body.errors.difficulty).toEqual(['Escolha a dificuldade.']);
    });

    it('disciplina inexistente → 422 em subject_id', async () => {
      const res = await create(
        teacher,
        payload({ subject_id: subjectId + 999 }),
      ).expect(422);
      expect(res.body.errors.subject_id).toEqual([
        'Disciplina não encontrada.',
      ]);
      expect(await prisma.question.count()).toBe(0);
    });

    it('subject_id fora do intervalo inteiro → 422, não 500', async () => {
      const res = await create(
        teacher,
        payload({ subject_id: 99_999_999_999 }),
      ).expect(422);
      expect(res.body.errors.subject_id).toEqual(['Escolha a disciplina.']);
    });

    it('categoria de outra disciplina → 422 em category_id e nada gravado', async () => {
      const other = await createCategory(prisma, { name: 'Outra' });
      const res = await create(
        teacher,
        payload({ category_id: other.id }),
      ).expect(422);
      expect(res.body.errors.category_id).toEqual([
        'A categoria não pertence à disciplina.',
      ]);
      expect(await prisma.question.count()).toBe(0);
      expect(await prisma.questionOption.count()).toBe(0);
    });

    it('categoria inexistente → 422 em category_id', async () => {
      const res = await create(
        teacher,
        payload({ category_id: categoryId + 999 }),
      ).expect(422);
      expect(res.body.errors.category_id).toEqual([
        'Categoria não encontrada.',
      ]);
    });

    it('aluno → 403 e sem token → 401', async () => {
      const student = await tokenFor(app, Role.Student);
      await create(student).expect(403);
      await http().post('/api/v1/questions').send(payload()).expect(401);
      expect(await prisma.question.count()).toBe(0);
    });
  });

  describe('GET /questions/:id', () => {
    it('devolve a questão completa', async () => {
      const created = await create(teacher).expect(201);
      const res = await http()
        .get(`/api/v1/questions/${created.body.id}`)
        .set(as(teacher))
        .expect(200);
      expect(res.body).toEqual(created.body);
    });

    it('can_edit é falso para outro professor e verdadeiro para admin', async () => {
      const created = await create(teacher).expect(201);
      const other = await tokenFor(app, Role.Teacher);
      const admin = await tokenFor(app, Role.Admin);
      const asOther = await http()
        .get(`/api/v1/questions/${created.body.id}`)
        .set(as(other))
        .expect(200);
      expect(asOther.body.can_edit).toBe(false);
      const asAdmin = await http()
        .get(`/api/v1/questions/${created.body.id}`)
        .set(as(admin))
        .expect(200);
      expect(asAdmin.body.can_edit).toBe(true);
    });

    it('inexistente ou id inválido → 404', async () => {
      for (const id of ['999', 'abc', '0']) {
        const res = await http()
          .get(`/api/v1/questions/${id}`)
          .set(as(teacher))
          .expect(404);
        expect(res.body).toEqual({ message: 'Questão não encontrada.' });
      }
    });

    it('aluno → 403', async () => {
      const student = await tokenFor(app, Role.Student);
      await http().get('/api/v1/questions/1').set(as(student)).expect(403);
    });
  });

  describe('PUT /questions/:id', () => {
    it('o autor edita e as alternativas são substituídas', async () => {
      const created = await create(teacher).expect(201);
      const options = LETTERS.map((letter) => ({
        letter,
        text: `Nova ${letter}`,
      }));
      const res = await http()
        .put(`/api/v1/questions/${created.body.id}`)
        .set(as(teacher))
        .send(
          payload({
            statement: 'Enunciado totalmente novo da questão.',
            difficulty: 'hard',
            options,
            correct_letter: 'E',
          }),
        )
        .expect(200);
      expect(res.body).toMatchObject({
        id: created.body.id,
        statement: 'Enunciado totalmente novo da questão.',
        difficulty: 'hard',
        correct_letter: 'E',
        options,
      });
      expect(await prisma.questionOption.count()).toBe(5);
    });

    it('outro professor → 403 e nada muda', async () => {
      const created = await create(teacher).expect(201);
      const other = await tokenFor(app, Role.Teacher);
      const res = await http()
        .put(`/api/v1/questions/${created.body.id}`)
        .set(as(other))
        .send(payload({ statement: 'Tentativa de alteração indevida.' }))
        .expect(403);
      expect(res.body).toEqual({
        message: 'Só o autor ou um administrador pode editar esta questão.',
      });
      const stored = await prisma.question.findUniqueOrThrow({
        where: { id: created.body.id },
      });
      expect(stored.statement).toBe('Quanto é 2 + 2 no sistema decimal?');
    });

    it('administrador edita questão de outro autor', async () => {
      const created = await create(teacher).expect(201);
      const admin = await tokenFor(app, Role.Admin);
      const res = await http()
        .put(`/api/v1/questions/${created.body.id}`)
        .set(as(admin))
        .send(payload({ statement: 'Revisado pela administração do banco.' }))
        .expect(200);
      expect(res.body.statement).toBe('Revisado pela administração do banco.');
      // O autor continua sendo quem criou.
      expect(res.body.author).toEqual(created.body.author);
    });

    it('inexistente → 404; dados inválidos → 422 e nada muda', async () => {
      await http()
        .put('/api/v1/questions/999')
        .set(as(teacher))
        .send(payload())
        .expect(404);
      const created = await create(teacher).expect(201);
      const other = await createCategory(prisma, {
        name: 'De outra disciplina',
      });
      const res = await http()
        .put(`/api/v1/questions/${created.body.id}`)
        .set(as(teacher))
        .send(payload({ category_id: other.id }))
        .expect(422);
      expect(res.body.errors.category_id).toEqual([
        'A categoria não pertence à disciplina.',
      ]);
      const after = await http()
        .get(`/api/v1/questions/${created.body.id}`)
        .set(as(teacher))
        .expect(200);
      expect(after.body).toEqual(created.body);
    });
  });

  describe('PATCH /questions/:id/status', () => {
    it('desativa e reativa', async () => {
      const created = await create(teacher).expect(201);
      const off = await http()
        .patch(`/api/v1/questions/${created.body.id}/status`)
        .set(as(teacher))
        .send({ active: false })
        .expect(200);
      expect(off.body.active).toBe(false);
      const on = await http()
        .patch(`/api/v1/questions/${created.body.id}/status`)
        .set(as(teacher))
        .send({ active: true })
        .expect(200);
      expect(on.body.active).toBe(true);
    });

    it('outro professor → 403; corpo inválido → 422; inexistente → 404', async () => {
      const created = await create(teacher).expect(201);
      const other = await tokenFor(app, Role.Teacher);
      await http()
        .patch(`/api/v1/questions/${created.body.id}/status`)
        .set(as(other))
        .send({ active: false })
        .expect(403);
      await http()
        .patch(`/api/v1/questions/${created.body.id}/status`)
        .set(as(teacher))
        .send({ active: 'talvez' })
        .expect(422);
      await http()
        .patch('/api/v1/questions/999/status')
        .set(as(teacher))
        .send({ active: false })
        .expect(404);
    });
  });

  describe('GET /questions', () => {
    it('lista resumos por updated_at decrescente', async () => {
      const first = await create(teacher).expect(201);
      const second = await create(
        teacher,
        payload({ statement: 'Segunda questão do banco de teste.' }),
      ).expect(201);
      // Editar a primeira a coloca no topo.
      await http()
        .put(`/api/v1/questions/${first.body.id}`)
        .set(as(teacher))
        .send(payload({ statement: 'Primeira questão, editada depois.' }))
        .expect(200);

      const res = await http()
        .get('/api/v1/questions')
        .set(as(teacher))
        .expect(200);
      expect(res.body.data.map((q: { id: number }) => q.id)).toEqual([
        first.body.id,
        second.body.id,
      ]);
      expect(res.body.data[0]).toEqual({
        id: first.body.id,
        statement_excerpt: 'Primeira questão, editada depois.',
        difficulty: 'easy',
        active: true,
        has_image: false,
        subject: { id: subjectId, name: 'Matemática', color: 'teal' },
        category: { id: categoryId, name: 'Aritmética' },
        author: first.body.author,
        updated_at: expect.any(String),
      });
      expect(res.body.meta).toEqual({
        page: 1,
        per_page: 15,
        total: 2,
        last_page: 1,
      });
    });

    it('o resumo corta o enunciado em 140 caracteres sem quebras de linha', async () => {
      await create(
        teacher,
        payload({ statement: `${'x'.repeat(100)}\n${'y'.repeat(100)}` }),
      ).expect(201);
      const res = await http()
        .get('/api/v1/questions')
        .set(as(teacher))
        .expect(200);
      expect(res.body.data[0].statement_excerpt).toBe(
        `${'x'.repeat(100)} ${'y'.repeat(39)}…`,
      );
    });

    it('filtra por disciplina, categoria, dificuldade e situação', async () => {
      const otherCategory = await createCategory(prisma, { name: 'Outra' });
      const a = await createQuestion(prisma, { subjectId, categoryId });
      const b = await createQuestion(prisma, {
        subjectId,
        categoryId,
        difficulty: 'hard',
        active: false,
      });
      const c = await createQuestion(prisma, {
        subjectId: otherCategory.subjectId,
        categoryId: otherCategory.id,
      });
      const ids = async (query: string): Promise<number[]> => {
        const res = await http()
          .get(`/api/v1/questions?${query}`)
          .set(as(teacher))
          .expect(200);
        return res.body.data.map((q: { id: number }) => q.id).sort();
      };
      expect(await ids(`subject_id=${subjectId}`)).toEqual([a.id, b.id]);
      expect(await ids(`subject_id=${otherCategory.subjectId}`)).toEqual([
        c.id,
      ]);
      expect(await ids(`category_id=${otherCategory.id}`)).toEqual([c.id]);
      expect(await ids('difficulty=hard')).toEqual([b.id]);
      expect(await ids('status=inactive')).toEqual([b.id]);
      expect(await ids('status=active')).toEqual([a.id, c.id]);
      expect(await ids(`subject_id=${subjectId}&status=active`)).toEqual([
        a.id,
      ]);
    });

    it('busca no enunciado sem diferenciar maiúsculas; "%" e "_" valem como texto', async () => {
      const pct = await createQuestion(prisma, {
        statement: 'Quanto vale 50% de 200 reais?',
      });
      await createQuestion(prisma, { statement: 'Qual a capital do Brasil?' });
      const names = async (search: string): Promise<number[]> => {
        const res = await http()
          .get('/api/v1/questions')
          .query({ search })
          .set(as(teacher))
          .expect(200);
        return res.body.data.map((q: { id: number }) => q.id);
      };
      expect(await names('CAPITAL')).toHaveLength(1);
      expect(await names('%')).toEqual([pct.id]);
      expect(await names('_')).toEqual([]);
      expect(await names('zzz')).toEqual([]);
    });

    it('pagina', async () => {
      for (let i = 0; i < 3; i += 1) {
        await createQuestion(prisma, { subjectId, categoryId });
      }
      const res = await http()
        .get('/api/v1/questions?page=2&per_page=2')
        .set(as(teacher))
        .expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toEqual({
        page: 2,
        per_page: 2,
        total: 3,
        last_page: 2,
      });
    });

    it('filtros inválidos → 422; aluno → 403', async () => {
      const res = await http()
        .get('/api/v1/questions?difficulty=x&status=y&subject_id=abc')
        .set(as(teacher))
        .expect(422);
      expect(Object.keys(res.body.errors).sort()).toEqual([
        'difficulty',
        'status',
        'subject_id',
      ]);
      const student = await tokenFor(app, Role.Student);
      await http().get('/api/v1/questions').set(as(student)).expect(403);
    });
  });

  describe('contagem e exclusão de disciplinas e categorias', () => {
    it('questions_count passa a refletir as questões', async () => {
      await createQuestion(prisma, { subjectId, categoryId });
      await createQuestion(prisma, { subjectId, categoryId, active: false });
      const subjects = await http()
        .get('/api/v1/subjects')
        .set(as(teacher))
        .expect(200);
      expect(subjects.body.data[0]).toMatchObject({
        id: subjectId,
        questions_count: 2,
      });
      const categories = await http()
        .get(`/api/v1/categories?subject_id=${subjectId}`)
        .set(as(teacher))
        .expect(200);
      expect(categories.body.data[0]).toMatchObject({
        id: categoryId,
        questions_count: 2,
      });
    });

    it('excluir categoria com questões → 409 e nada é excluído', async () => {
      await createQuestion(prisma, { subjectId, categoryId });
      const res = await http()
        .delete(`/api/v1/categories/${categoryId}`)
        .set(as(teacher))
        .expect(409);
      expect(res.body).toEqual({
        message: 'Não é possível excluir: a categoria tem questões.',
      });
      expect(await prisma.category.count({ where: { id: categoryId } })).toBe(
        1,
      );
      expect(await prisma.question.count()).toBe(1);
    });

    it('excluir disciplina com questões (e categorias) → 409 e nada é excluído', async () => {
      await createQuestion(prisma, { subjectId, categoryId });
      const res = await http()
        .delete(`/api/v1/subjects/${subjectId}`)
        .set(as(teacher))
        .expect(409);
      expect(res.body).toEqual({
        message:
          'Não é possível excluir: a disciplina tem categorias ou questões.',
      });
      expect(await prisma.subject.count({ where: { id: subjectId } })).toBe(1);
      expect(await prisma.category.count({ where: { id: categoryId } })).toBe(
        1,
      );
    });

    it('excluir disciplina com questão mas sem categorias → 409 pela contagem de questões', async () => {
      // Dado inconsistente de propósito (a API não o produz): a disciplina "vazia"
      // não tem categorias, só uma questão apontando para ela.
      const empty = await createSubject(prisma, { name: 'Sem categorias' });
      await createQuestion(prisma, { subjectId: empty.id, categoryId });
      const res = await http()
        .delete(`/api/v1/subjects/${empty.id}`)
        .set(as(teacher))
        .expect(409);
      expect(res.body.message).toBe(
        'Não é possível excluir: a disciplina tem categorias ou questões.',
      );
      expect(await prisma.subject.count({ where: { id: empty.id } })).toBe(1);
    });
  });
});
