import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Esvazia todas as tabelas da aplicação (schema public, exceto o controle de
 * migrations) e reinicia as sequências. Chamar em beforeEach/beforeAll dos
 * e2e que gravam no banco; as tabelas são descobertas em pg_tables, então
 * novos models entram sozinhos.
 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) {
    return;
  }
  const names = tables
    .map(({ tablename }) => `"public"."${tablename.replace(/"/g, '""')}"`)
    .join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`,
  );
}
