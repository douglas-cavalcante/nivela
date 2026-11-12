// Prints do painel web (1440x900, tema claro) com os dados de demonstração.
// Uso: WEB_URL=http://localhost:5199 API_URL=http://localhost:3101/api/v1 node scripts/prints/web-prints.mjs
// Pré-requisito: API contra um banco com o seed de demonstração (veja docs/prints/README.md).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5199';
const API = process.env.API_URL ?? 'http://localhost:3101/api/v1';
const OUT = join(process.cwd(), 'docs', 'prints', 'web');
const PASSWORD = 'nivela123';
const ANA = 'ana.lima@nivela.test';
const ADMIN = 'admin@nivela.test';

mkdirSync(OUT, { recursive: true });

async function api(path, token) {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function apiLogin(email) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, channel: 'web' }),
  });
  return (await res.json()).token;
}

/** Espera o carregamento terminar: sem barras de progresso e sem rede pendente. */
async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !document.querySelector('.MuiCircularProgress-root, .MuiLinearProgress-root, .MuiSkeleton-root'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

async function login(browser, email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'pt-BR' });
  await context.addInitScript(() => window.localStorage.setItem('nivela.theme', 'light'));
  const page = await context.newPage();
  await page.goto(`${WEB}/login`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('textbox', { name: 'Senha' }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(`${WEB}/`);
  await settle(page);
  return { context, page };
}

/** Telas longas (`tall`): a janela cresce até caber a página, para a barra lateral não ficar cortada. */
async function shot(page, file, { tall = false } = {}) {
  await settle(page);
  await page.mouse.move(120, 700);
  if (tall) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 1440, height: Math.max(900, height) });
    await settle(page);
  }
  await page.screenshot({ path: join(OUT, `${file}.png`) });
  if (tall) await page.setViewportSize({ width: 1440, height: 900 });
  console.log(`Salvo ${file}.png`);
}

async function go(page, path) {
  await page.goto(`${WEB}${path}`);
  await settle(page);
}

const browser = await chromium.launch();
try {
  const anaToken = await apiLogin(ANA);
  const classroom = (await api('/classrooms', anaToken)).data.find((c) => c.name.startsWith('9'));
  const student = (await api('/students?search=Marina', anaToken)).data[0];
  const plan = (await api('/plans', anaToken)).data.find((p) => p.subject.name === 'Matemática');
  const question = (await api('/questions', anaToken)).data.find((q) => q.has_image && q.author.name === 'Ana Lima');

  // 01 login, antes de entrar
  const anon = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'pt-BR' });
  await anon.addInitScript(() => window.localStorage.setItem('nivela.theme', 'light'));
  const loginPage = await anon.newPage();
  await go(loginPage, '/login');
  await shot(loginPage, '01-login');
  await anon.close();

  const ana = await login(browser, ANA);
  const p = ana.page;
  await shot(p, '02-inicio');
  await go(p, '/questoes');
  await shot(p, '03-questoes');
  await go(p, `/questoes/${question.id}`);
  await shot(p, '04-questao-com-imagem', { tall: true });
  await go(p, `/turmas/${classroom.id}`);
  await shot(p, '05-turma', { tall: true });
  await go(p, `/alunos/${student.id}`);
  await shot(p, '06-aluno', { tall: true });
  await go(p, `/planos/${plan.id}`);
  await shot(p, '07-plano-editor', { tall: true });
  await go(p, '/loja');
  await shot(p, '09-loja-premios');
  await ana.context.close();

  const admin = await login(browser, ADMIN);
  await go(admin.page, `/planos/${plan.id}`);
  await admin.page.getByRole('tab', { name: 'Progresso' }).click();
  await shot(admin.page, '08-plano-progresso', { tall: true });
  await go(admin.page, '/loja');
  await admin.page.getByRole('tab', { name: /Resgates/ }).click();
  await shot(admin.page, '10-loja-resgates');
  await admin.context.close();
} finally {
  await browser.close();
}
