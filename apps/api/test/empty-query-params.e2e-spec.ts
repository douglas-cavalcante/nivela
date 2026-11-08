import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import { tokenFor } from './helpers/login';
import { resetDatabase } from './helpers/reset-database';

/** Ruling 10: parâmetro de query vazio vale como ausente em toda listagem. */
describe('Listagens com parâmetros vazios (e2e)', () => {
  let app: INestApplication;
  let admin: string;

  beforeAll(async () => {
    app = await createTestApp();
    const prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    admin = await tokenFor(app, Role.Admin);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    '/questions?subject_id=&category_id=&difficulty=&status=&search=&page=&per_page=',
    '/students?classroom_id=&search=&page=&per_page=',
    '/classrooms?status=&search=&page=&per_page=',
    '/teachers?status=&search=&page=&per_page=',
    '/categories?subject_id=',
  ])('GET %s → 200', async (path) => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1${path}`)
      .set({ Authorization: `Bearer ${admin}` })
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.meta) {
      expect(res.body.meta).toMatchObject({ page: 1, per_page: 15 });
    }
  });
});
