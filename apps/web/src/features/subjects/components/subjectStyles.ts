import { subjectColors, themes } from '@nivela/design-tokens';
import type { SubjectColorKey, ThemeMode } from '@nivela/design-tokens';

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Cor resultante de `foreground` com opacidade `alpha` sobre `background` (hex opaco). */
export function blend(foreground: string, background: string, alpha: number): string {
  const f = toRgb(foreground);
  const b = toRgb(background);
  const mixed = f.map((value, index) => Math.round(value * alpha + (b[index] ?? 0) * (1 - alpha)));
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

/** Marca-texto sob o nome da disciplina: tinta suave no claro, tinta translúcida da cor no escuro. */
export function subjectMarker(mode: ThemeMode, key: SubjectColorKey): string {
  const color = subjectColors[mode][key];
  return mode === 'dark' ? blend(color.foreground, themes.dark.surface, 0.35) : color.background;
}

/** Borda de uma bolinha de seletor: a cor "de tinta" da disciplina; a escolhida usa o traço do caderno. */
export function swatchBorder(mode: ThemeMode, key: SubjectColorKey, checked: boolean): string {
  return checked ? themes[mode].border : subjectColors[mode][key].foreground;
}
