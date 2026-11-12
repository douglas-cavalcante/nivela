// Gera os ícones do app (PNG) a partir do mascote Rabisco e das cores dos tokens.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { brand, mascot } from '@nivela/design-tokens';

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

/** Desenho do mascote como SVG; `scale` < 1 deixa margem de segurança ao redor. */
function mascotSvg({ size, background, scale }) {
  const paint = (key) => brand[key];
  const shapes = mascot.shapes
    .map((shape) => {
      const fill = shape.fill === 'none' ? 'none' : paint(shape.fill);
      const stroke = shape.stroke ? paint(shape.stroke) : 'none';
      return `<path d="${shape.d}" fill="${fill}" stroke="${stroke}"/>`;
    })
    .join('');
  const offset = (64 - 64 * scale) / 2;
  const bg = background ? `<rect width="64" height="64" fill="${background}"/>` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">` +
    `${bg}<g transform="translate(${offset} ${offset}) scale(${scale})" ` +
    `stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${shapes}</g></svg>`
  );
}

const icons = [
  // ícone do app: fundo de papel; o desenho ocupa ~80% para não encostar nas bordas
  { file: 'icon.png', size: 1024, background: brand.paper, scale: 0.8 },
  // primeiro plano do ícone adaptativo: fundo transparente; zona segura é ~66% central
  { file: 'adaptive-icon.png', size: 1024, background: null, scale: 0.62 },
  { file: 'splash-icon.png', size: 1024, background: null, scale: 1 },
];

mkdirSync(assets, { recursive: true });
for (const { file, ...options } of icons) {
  const png = new Resvg(mascotSvg(options)).render().asPng();
  writeFileSync(join(assets, file), png);
  console.log(`Gerado assets/${file} (${png.length} bytes).`);
}
