// Roda antes de cada arquivo e2e (setupFiles do jest-e2e.json).
// Carrega o .env.test e garante que os testes só toquem em um banco "_test",
// já que `prisma migrate reset` e os testes apagam dados.
import { config } from 'dotenv';
import { join } from 'node:path';

config({ path: join(__dirname, '..', '.env.test'), override: true });
process.env.NODE_ENV = 'test';

const url = process.env.DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) {
  throw new Error(
    `Os testes e2e exigem DATABASE_URL apontando para um banco terminado em _test (veio ${url}).`,
  );
}
