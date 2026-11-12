import { INestApplication } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { studyDay } from 'src/shared/study/study-day';
import { studyDaySql } from 'src/shared/study/study-day.sql';
import { createTestApp } from './helpers/create-test-app';

describe('studyDaySql contra studyDay (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const instants = [
    '2026-11-10T02:50:00Z', // 23h50 de 09/11 em Fortaleza
    '2026-11-10T02:59:59.999Z',
    '2026-11-10T03:00:00Z', // meia-noite em Fortaleza
    '2026-11-10T03:10:00Z', // 00h10 de 10/11
    '2026-12-31T23:59:00Z',
    '2027-01-01T02:59:00Z',
  ];

  it.each(instants)('coincide com studyDay em %s', async (iso) => {
    const rows = await prisma.$queryRaw<{ day: string }[]>(
      Prisma.sql`SELECT to_char(${studyDaySql('t.moment')}, 'YYYY-MM-DD') AS day
        FROM (SELECT ${iso}::timestamptz AS moment) t`,
    );
    expect(rows[0].day).toBe(studyDay(new Date(iso)));
  });

  it('separa 23h50 e 00h10 de Fortaleza em dias diferentes', async () => {
    const rows = await prisma.$queryRaw<{ a: string; b: string }[]>(
      Prisma.sql`SELECT
        to_char(${studyDaySql('t.a')}, 'YYYY-MM-DD') AS a,
        to_char(${studyDaySql('t.b')}, 'YYYY-MM-DD') AS b
        FROM (SELECT '2026-11-10T02:50:00Z'::timestamptz AS a,
                     '2026-11-10T03:10:00Z'::timestamptz AS b) t`,
    );
    expect(rows[0]).toEqual({ a: '2026-11-09', b: '2026-11-10' });
  });
});
