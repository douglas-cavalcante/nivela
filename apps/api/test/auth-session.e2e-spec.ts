import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import { createUser, DEFAULT_PASSWORD } from './helpers/factories';
import { resetDatabase } from './helpers/reset-database';

describe('Auth - sessão (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());

  async function loginAs(email: string, password = DEFAULT_PASSWORD) {
    const { body } = await http()
      .post('/api/v1/auth/login')
      .send({ email, password, channel: 'web' })
      .expect(200);
    return body.token as string;
  }

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

  it('retorna o usuário logado', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });
    const token = await loginAs(teacher.email);

    const { body } = await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body).toEqual({
      user: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        role: 'teacher',
      },
    });
  });

  it('atualiza o último uso do token', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });
    const token = await loginAs(teacher.email);
    expect((await prisma.accessToken.findFirstOrThrow()).lastUsedAt).toBeNull();

    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      (await prisma.accessToken.findFirstOrThrow()).lastUsedAt,
    ).not.toBeNull();
  });

  it('logout revoga o token', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });
    const token = await loginAs(teacher.email);

    await http()
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    expect(await prisma.accessToken.count()).toBe(0);
  });

  it('o logout revoga só o token usado', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });
    const first = await loginAs(teacher.email);
    const second = await loginAs(teacher.email);

    await http()
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${first}`)
      .expect(204);

    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${second}`)
      .expect(200);
  });

  it('troca a senha', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });
    const token = await loginAs(teacher.email);

    await http()
      .put('/api/v1/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        current_password: DEFAULT_PASSWORD,
        password: 'nova-senha-123',
        password_confirmation: 'nova-senha-123',
      })
      .expect(204);

    await loginAs(teacher.email, 'nova-senha-123');
    await http()
      .post('/api/v1/auth/login')
      .send({
        email: teacher.email,
        password: DEFAULT_PASSWORD,
        channel: 'web',
      })
      .expect(422);
  });

  it('recusa senha atual errada', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });
    const token = await loginAs(teacher.email);

    const { body } = await http()
      .put('/api/v1/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        current_password: 'errada-errada',
        password: 'nova-senha-123',
        password_confirmation: 'nova-senha-123',
      })
      .expect(422);

    expect(body.errors.current_password).toEqual([
      'A senha atual está incorreta.',
    ]);
  });

  it('valida a nova senha (mínimo e confirmação)', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });
    const token = await loginAs(teacher.email);

    const { body } = await http()
      .put('/api/v1/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        current_password: DEFAULT_PASSWORD,
        password: 'curta',
        password_confirmation: 'diferente',
      })
      .expect(422);

    expect(body.errors.password).toBeDefined();
    expect(body.errors.password_confirmation[0]).toBe(
      'A confirmação de senha não confere.',
    );
  });

  it('exige autenticação', async () => {
    const { body } = await http().get('/api/v1/auth/me').expect(401);
    expect(body).toEqual({ message: 'Não autenticado.' });

    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer token-inventado')
      .expect(401);
    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', 'Basic abc')
      .expect(401);
    await http().post('/api/v1/auth/logout').expect(401);
    await http().put('/api/v1/auth/password').expect(401);
  });

  it('usuário desativado depois do login perde o acesso', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });
    const token = await loginAs(teacher.email);

    await prisma.user.update({
      where: { id: teacher.id },
      data: { active: false },
    });

    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('mantém a rota de saúde pública', async () => {
    await http().get('/api/v1/health').expect(200);
  });

  it('trocar a senha encerra as outras sessões e mantém a atual', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });
    const sessionA = await loginAs(teacher.email);
    const sessionB = await loginAs(teacher.email);

    await http()
      .put('/api/v1/auth/password')
      .set('Authorization', `Bearer ${sessionA}`)
      .send({
        current_password: DEFAULT_PASSWORD,
        password: 'nova-senha-123',
        password_confirmation: 'nova-senha-123',
      })
      .expect(204);

    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${sessionB}`)
      .expect(401);
    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${sessionA}`)
      .expect(200);
  });
});
