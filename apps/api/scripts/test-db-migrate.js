// Aplica as migrations (prisma migrate deploy) no banco de teste (nivela_test) antes dos e2e.
// Usa o DATABASE_URL do ambiente (CI) ou, na falta dele, o de .env.test, e se recusa a rodar fora de um banco "_test".
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
const { parsed } = dotenv.config({ path: path.join(root, '.env.test'), quiet: true });
const url = process.env.DATABASE_URL ?? parsed?.DATABASE_URL;

if (!url || !new URL(url).pathname.endsWith('_test')) {
  console.error(
    `DATABASE_URL (ambiente ou .env.test) precisa apontar para um banco terminado em _test (veio ${url}).`,
  );
  process.exit(1);
}

const result = spawnSync(
  'npx',
  ['prisma', 'migrate', 'deploy'],
  {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: url },
  },
);
process.exit(result.status ?? 1);
