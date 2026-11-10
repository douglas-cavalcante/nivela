import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import { createQuestion } from './helpers/factories';
import { sessionFor, tokenFor } from './helpers/login';
import { resetDatabase } from './helpers/reset-database';

const LOCKED =
  'Esta questão já foi respondida; não é possível trocar a alternativa correta.';

describe('Edição de questão respondida (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: string;
  let student: string;

  const server = () => app.getHttpServer();
  const payload = (
    question: { subjectId: number; categoryId: number },
    overrides: Record<string, unknown> = {},
  ) => ({
    subject_id: question.subjectId,
    category_id: question.categoryId,
    statement: 'Enunciado editado da questão?',
    difficulty: 'hard',
    explanation: 'Explicação editada.',
    options: ['A', 'B', 'C', 'D', 'E'].map((letter) => ({
      letter,
      text: `Alternativa ${letter}`,
    })),
    correct_letter: 'A',
    ...overrides,
  });
  const put = (id: number, body: object) =>
    request(server())
      .put(`/api/v1/questions/${id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send(body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = await tokenFor(app, Role.Admin);
    student = (await sessionFor(app, Role.Student)).token;
  });

  const answered = async () => {
    const question = await createQuestion(prisma);
    await request(server())
      .post('/api/v1/answers')
      .set('Authorization', `Bearer ${student}`)
      .send({ question_id: question.id, selected_letter: 'B' })
      .expect(200);
    return question;
  };

  it('trocar a alternativa correta de questão com tentativas responde 409 e nada muda', async () => {
    const question = await answered();
    const { body } = await put(
      question.id,
      payload(question, {
        correct_letter: 'C',
        statement: 'Outro enunciado!!',
      }),
    ).expect(409);
    expect(body).toMatchObject({ message: LOCKED });

    const stored = await prisma.question.findUniqueOrThrow({
      where: { id: question.id },
      include: { options: true },
    });
    expect(stored.statement).toBe(question.statement);
    expect(stored.options.find((o) => o.isCorrect)?.letter).toBe('A');
  });

  it('texto, enunciado, dificuldade e explicação continuam editáveis (mantendo a correta)', async () => {
    const question = await answered();
    const { body } = await put(question.id, payload(question)).expect(200);
    expect(body).toMatchObject({
      statement: 'Enunciado editado da questão?',
      difficulty: 'hard',
      explanation: 'Explicação editada.',
      correct_letter: 'A',
    });
  });

  it('sem tentativas, a alternativa correta pode ser trocada', async () => {
    const question = await createQuestion(prisma);
    const { body } = await put(
      question.id,
      payload(question, { correct_letter: 'C' }),
    ).expect(200);
    expect(body).toMatchObject({ correct_letter: 'C' });
  });
});
