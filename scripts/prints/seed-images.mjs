// Envia imagens do mascote (prêmios e questões) para a API de demonstração, para os prints mostrarem imagens.
// Uso: API_URL=http://localhost:3101/api/v1 npx tsx scripts/prints/seed-images.mjs
import { Resvg } from '@resvg/resvg-js';
import { brand, mascot } from '@nivela/design-tokens';

const API = process.env.API_URL ?? 'http://localhost:3101/api/v1';
const REWARD_IDS = (process.env.REWARD_NAMES ?? 'Caderno personalizado,Adesivos do Rabisco,15 minutos de leitura livre').split(',');
const BACKGROUNDS = [brand.paper, '#fde9c8', '#dff0e6'];

function mascotPng(background) {
  const paint = (key) => brand[key];
  const shapes = mascot.shapes
    .map((s) => `<path d="${s.d}" fill="${s.fill === 'none' ? 'none' : paint(s.fill)}" stroke="${s.stroke ? paint(s.stroke) : 'none'}"/>`)
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="480" height="480">` +
    `<rect width="64" height="64" fill="${background}"/><g transform="translate(8 8) scale(0.75)" ` +
    `stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${shapes}</g></svg>`;
  return new Resvg(svg).render().asPng();
}

async function call(path, token, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers } });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function upload(path, token, png, name) {
  const form = new FormData();
  form.append('image', new Blob([png], { type: 'image/png' }), name);
  await call(path, token, { method: 'POST', body: form });
}

const { token } = await call('/auth/login', null, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'ana.lima@nivela.test', password: 'nivela123', channel: 'web' }),
});

const rewards = (await call('/rewards', token)).data;
for (const [i, name] of REWARD_IDS.entries()) {
  const reward = rewards.find((r) => r.name === name);
  if (!reward) { console.log(`Prêmio "${name}" não encontrado.`); continue; }
  await upload(`/rewards/${reward.id}/image`, token, mascotPng(BACKGROUNDS[i % 3]), 'premio.png');
  console.log(`Imagem enviada ao prêmio ${reward.id} (${name}).`);
}

const questions = (await call('/questions', token)).data.filter((q) => q.author.name === 'Ana Lima').slice(0, 2);
for (const [i, q] of questions.entries()) {
  await upload(`/questions/${q.id}/image`, token, mascotPng(BACKGROUNDS[(i + 1) % 3]), 'questao.png');
  console.log(`Imagem enviada à questão ${q.id}.`);
}
