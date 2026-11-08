import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { createTestApp } from './helpers/create-test-app';
import { createClassroom, createUser } from './helpers/factories';
import { resetDatabase } from './helpers/reset-database';

describe('Auth - cadastro de aluno (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const valid = {
    name: 'Bia Souza',
    email: 'bia@aluno.com',
    password: 'segredo123',
    password_confirmation: 'segredo123',
    join_code: 'NIV-4K7Q',
  };

  const register = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/register-student')
      .send(body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('cadastra aluno com código da turma', async () => {
    const classroom = await createClassroom(prisma, { joinCode: 'NIV-4K7Q' });

    const { body } = await register(valid).expect(201);

    expect(body.user).toMatchObject({
      name: 'Bia Souza',
      email: 'bia@aluno.com',
      role: 'student',
    });
    expect(typeof body.token).toBe('string');

    const profile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: body.user.id },
    });
    expect(profile.coinsBalance).toBe(0);
    expect(profile.currentStreak).toBe(0);
    expect(profile.bestStreak).toBe(0);

    const link = await prisma.classroomStudent.findMany({
      where: { studentId: body.user.id },
    });
    expect(link).toHaveLength(1);
    expect(link[0].classroomId).toBe(classroom.id);

    const token = await prisma.accessToken.findFirstOrThrow({
      where: { userId: body.user.id },
    });
    expect(token.channel).toBe('mobile');
  });

  it('o token devolvido já autentica o aluno', async () => {
    await createClassroom(prisma, { joinCode: 'NIV-4K7Q' });

    const { body } = await register(valid).expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.token}`)
      .expect(200);
  });

  it('aceita código em minúsculas com espaços', async () => {
    await createClassroom(prisma, { joinCode: 'NIV-4K7Q' });

    await register({ ...valid, join_code: ' niv-4k7q ' }).expect(201);
  });

  it('normaliza o e-mail no cadastro', async () => {
    await createClassroom(prisma, { joinCode: 'NIV-4K7Q' });

    const { body } = await register({
      ...valid,
      email: ' Bia@Aluno.COM ',
    }).expect(201);

    expect(body.user.email).toBe('bia@aluno.com');
  });

  it('recusa código inexistente', async () => {
    const { body } = await register(valid).expect(422);

    expect(body.errors.join_code[0]).toBe('Código de turma inválido.');
  });

  it('recusa turma inativa', async () => {
    await createClassroom(prisma, { joinCode: 'NIV-4K7Q', active: false });

    const { body } = await register(valid).expect(422);

    expect(body.errors.join_code[0]).toBe(
      'Esta turma não está aceitando novos alunos.',
    );
  });

  it('recusa e-mail já cadastrado, inclusive com maiúsculas', async () => {
    await createClassroom(prisma, { joinCode: 'NIV-4K7Q' });
    await createUser(prisma, { email: 'bia@aluno.com' });

    const exact = await register(valid).expect(422);
    expect(exact.body.errors.email[0]).toBe('Este e-mail já está cadastrado.');

    const upper = await register({
      ...valid,
      email: ' BIA@Aluno.com ',
    }).expect(422);
    expect(upper.body.errors.email[0]).toBe('Este e-mail já está cadastrado.');
  });

  it('e-mail já cadastrado + código inválido: só acusa o código (não revela o e-mail)', async () => {
    await createUser(prisma, { email: 'bia@aluno.com' });

    const { body } = await register(valid).expect(422);

    expect(body.errors).toEqual({ join_code: ['Código de turma inválido.'] });
  });

  it('e-mail já cadastrado + turma inativa: só acusa o código', async () => {
    await createClassroom(prisma, { joinCode: 'NIV-4K7Q', active: false });
    await createUser(prisma, { email: 'bia@aluno.com' });

    const { body } = await register(valid).expect(422);

    expect(body.errors).toEqual({
      join_code: ['Esta turma não está aceitando novos alunos.'],
    });
  });

  it('e-mail já cadastrado + código válido: 422 no e-mail', async () => {
    await createClassroom(prisma, { joinCode: 'NIV-4K7Q' });
    await createUser(prisma, { email: 'bia@aluno.com' });

    const { body } = await register(valid).expect(422);

    expect(body.errors).toEqual({ email: ['Este e-mail já está cadastrado.'] });
  });

  it('exige senha de 8 caracteres e confirmação igual', async () => {
    await createClassroom(prisma, { joinCode: 'NIV-4K7Q' });

    const short = await register({
      ...valid,
      password: 'curta12',
      password_confirmation: 'curta12',
    }).expect(422);
    expect(short.body.errors.password).toBeDefined();

    const mismatch = await register({
      ...valid,
      password_confirmation: 'outra-senha',
    }).expect(422);
    expect(mismatch.body.errors.password_confirmation[0]).toBe(
      'A confirmação de senha não confere.',
    );
  });

  it('não cria nada se o vínculo falhar', async () => {
    await register(valid).expect(422);

    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.studentProfile.count()).toBe(0);
    expect(await prisma.accessToken.count()).toBe(0);
  });

  it('desfaz o cadastro se a gravação do vínculo falhar no meio da transação', async () => {
    await createClassroom(prisma, { joinCode: 'NIV-4K7Q' });
    const original = prisma.$transaction.bind(prisma);
    // Força o erro dentro da transação, depois de user e student_profile.
    const spy = jest.spyOn(prisma, '$transaction').mockImplementationOnce(((
      fn: (tx: PrismaService) => Promise<unknown>,
    ) =>
      original((tx) =>
        fn(
          new Proxy(tx, {
            get(target, prop, receiver) {
              if (prop === 'classroomStudent') {
                return {
                  create: () => Promise.reject(new Error('falha simulada')),
                };
              }
              return Reflect.get(target, prop, receiver);
            },
          }) as unknown as PrismaService,
        ),
      )) as unknown as typeof prisma.$transaction);

    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await register(valid).expect(500);
    spy.mockRestore();
    log.mockRestore();

    expect(await prisma.user.count({ where: { role: 'student' } })).toBe(0);
    expect(await prisma.studentProfile.count()).toBe(0);
  });

  it('e-mails que só diferem por _ coexistem e a checagem de duplicidade é exata', async () => {
    await createClassroom(prisma, { joinCode: 'NIV-4K7Q' });
    await createUser(prisma, { email: 'joao_silva@a.com' });

    await register({ ...valid, email: 'joaoxsilva@a.com' }).expect(201);

    const dup = await register({
      ...valid,
      email: 'joao_silva@a.com',
    }).expect(422);
    expect(dup.body.errors.email[0]).toBe('Este e-mail já está cadastrado.');
  });

  it('rejeita nome só com espaços', async () => {
    await createClassroom(prisma, { joinCode: 'NIV-4K7Q' });

    const { body } = await register({ ...valid, name: '   ' }).expect(422);

    expect(body.errors.name).toBeDefined();
    expect(await prisma.user.count({ where: { role: 'student' } })).toBe(0);
  });
});
