import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import { createUser, DEFAULT_PASSWORD } from './helpers/factories';
import { resetDatabase } from './helpers/reset-database';

const MESSAGE = 'Muitas tentativas. Aguarde um pouco e tente de novo.';
const KEYS = [
  'THROTTLE_LOGIN_LIMIT',
  'THROTTLE_REGISTER_LIMIT',
  'THROTTLE_TTL_SECONDS',
] as const;

describe('Limite de tentativas (e2e)', () => {
  let app: INestApplication;
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const key of KEYS) saved[key] = process.env[key];
    process.env.THROTTLE_LOGIN_LIMIT = '3';
    process.env.THROTTLE_REGISTER_LIMIT = '4';
    process.env.THROTTLE_TTL_SECONDS = '5';
    app = await createTestApp();
    await resetDatabase(app.get(PrismaService));
  });

  afterAll(async () => {
    await app.close();
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  const login = (email: string, password: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password, channel: 'web' });

  it('o 4º login errado do mesmo e-mail e ip → 429 com mensagem e Retry-After', async () => {
    const user = await createUser(app.get(PrismaService), {
      role: Role.Teacher,
    });
    for (let i = 0; i < 3; i++) {
      await login(user.email, 'errada').expect(422);
    }
    const res = await login(user.email, 'errada').expect(429);
    expect(res.body).toEqual({ message: MESSAGE });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('outro e-mail do mesmo ip não é bloqueado (turma no mesmo Wi-Fi)', async () => {
    const prisma = app.get(PrismaService);
    const a = await createUser(prisma, { role: Role.Teacher });
    const b = await createUser(prisma, { role: Role.Teacher });
    for (let i = 0; i < 4; i++) {
      await login(a.email, 'errada');
    }
    await login(a.email, 'errada').expect(429);
    await login(b.email, DEFAULT_PASSWORD).expect(200);
  });

  it('o e-mail é normalizado (maiúsculas e espaços contam como o mesmo)', async () => {
    const user = await createUser(app.get(PrismaService), {
      role: Role.Teacher,
    });
    for (const variant of [user.email, user.email.toUpperCase(), user.email]) {
      await login(variant, 'errada').expect(422);
    }
    await login(`  ${user.email.toUpperCase()} `, 'errada').expect(429);
  });

  it('volta a funcionar depois da janela', async () => {
    const user = await createUser(app.get(PrismaService), {
      role: Role.Teacher,
    });
    for (let i = 0; i < 3; i++) {
      await login(user.email, 'errada').expect(422);
    }
    await login(user.email, DEFAULT_PASSWORD).expect(429);
    await new Promise((resolve) => setTimeout(resolve, 5200));
    await login(user.email, DEFAULT_PASSWORD).expect(200);
  }, 15_000);

  it('o cadastro estoura por ip no limite configurado', async () => {
    const register = (n: number) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/register-student')
        .send({
          name: `Aluno ${n}`,
          email: `limite${n}@escola.test`,
          password: 'senha-segura-123',
        });
    for (let n = 0; n < 4; n++) {
      const res = await register(n);
      expect(res.status).not.toBe(429);
    }
    const res = await register(99).expect(429);
    expect(res.body).toEqual({ message: MESSAGE });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('rotas fora da autenticação nunca recebem 429', async () => {
    for (let i = 0; i < 20; i++) {
      await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    }
  });
});
