// Recria o banco de teste (nivela_test) antes dos testes e2e.
// Lê o DATABASE_URL de .env.test e se recusa a rodar fora de um banco "_test".
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
const { parsed } = dotenv.config({ path: path.join(root, '.env.test') });
const url = parsed?.DATABASE_URL;

if (!url || !new URL(url).pathname.endsWith('_test')) {
  console.error(
    `DATABASE_URL de .env.test precisa apontar para um banco terminado em _test (veio ${url}).`,
  );
  process.exit(1);
}

const result = spawnSync(
  'npx',
  ['prisma', 'migrate', 'reset', '--force'],
  {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: url },
  },
);
process.exit(result.status ?? 1);
