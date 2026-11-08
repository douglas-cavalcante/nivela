import { INestApplication } from '@nestjs/common';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import { createUser, DEFAULT_PASSWORD } from './helpers/factories';
import { resetDatabase } from './helpers/reset-database';

describe('Auth - login (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const login = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send(body);

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

  it('faz login do professor pelo web', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });

    const { body } = await login({
      email: teacher.email,
      password: DEFAULT_PASSWORD,
      channel: 'web',
    }).expect(200);

    expect(body.user).toEqual({
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      role: 'teacher',
    });
    expect(typeof body.token).toBe('string');
    expect(body.user.password).toBeUndefined();
  });

  it('aceita e-mail com maiúsculas e espaços', async () => {
    await createUser(prisma, { role: Role.Teacher, email: 'ana@escola.com' });

    await login({
      email: ' Ana@Escola.com ',
      password: DEFAULT_PASSWORD,
      channel: 'web',
    }).expect(200);
  });

  it('recusa senha errada', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });

    const { body } = await login({
      email: teacher.email,
      password: 'senha-errada',
      channel: 'web',
    }).expect(422);

    expect(body.errors.email).toEqual(['E-mail ou senha inválidos.']);
  });

  it('recusa e-mail inexistente com a mesma mensagem', async () => {
    const { body } = await login({
      email: 'ninguem@escola.com',
      password: DEFAULT_PASSWORD,
      channel: 'web',
    }).expect(422);

    expect(body.errors.email).toEqual(['E-mail ou senha inválidos.']);
  });

  it('valida os campos obrigatórios e o canal', async () => {
    const { body } = await login({ channel: 'desktop' }).expect(422);

    expect(body.errors.email).toBeDefined();
    expect(body.errors.password).toBeDefined();
    expect(body.errors.channel).toBeDefined();
  });

  it('recusa usuário desativado', async () => {
    const teacher = await createUser(prisma, {
      role: Role.Teacher,
      active: false,
    });

    const { body } = await login({
      email: teacher.email,
      password: DEFAULT_PASSWORD,
      channel: 'web',
    }).expect(403);

    expect(body.message).toBe('Usuário desativado.');
  });

  it('recusa aluno no canal web', async () => {
    const student = await createUser(prisma, { role: Role.Student });

    const { body } = await login({
      email: student.email,
      password: DEFAULT_PASSWORD,
      channel: 'web',
    }).expect(403);

    expect(body.message).toBe('Alunos acessam pelo aplicativo Nivela.');
  });

  it('recusa professor no canal mobile', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });

    const { body } = await login({
      email: teacher.email,
      password: DEFAULT_PASSWORD,
      channel: 'mobile',
    }).expect(403);

    expect(body.message).toBe(
      'Professores e administradores acessam pelo painel web.',
    );
  });

  it('recusa administrador no canal mobile', async () => {
    const admin = await createUser(prisma, { role: Role.Admin });

    await login({
      email: admin.email,
      password: DEFAULT_PASSWORD,
      channel: 'mobile',
    }).expect(403);
  });

  it('faz login do aluno pelo mobile', async () => {
    const student = await createUser(prisma, { role: Role.Student });

    const { body } = await login({
      email: student.email,
      password: DEFAULT_PASSWORD,
      channel: 'mobile',
    }).expect(200);

    expect(body.user.role).toBe('student');
  });

  it('guarda só o hash do token', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });

    const { body } = await login({
      email: teacher.email,
      password: DEFAULT_PASSWORD,
      channel: 'web',
    }).expect(200);

    const stored = await prisma.accessToken.findMany();
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).not.toBe(body.token);
    expect(stored[0].tokenHash).toBe(
      createHash('sha256').update(body.token).digest('hex'),
    );
    expect(stored[0].channel).toBe('web');
  });
});
