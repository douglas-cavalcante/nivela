import { brand } from './colors';
import type { ThemeMode } from './colors';

export type SubjectColorKey = 'teal' | 'coral' | 'violet' | 'sky' | 'amber' | 'rose';

export type SubjectIconKey = 'calculator' | 'book' | 'flask' | 'globe' | 'palette' | 'language';

export const subjectColorKeys: readonly SubjectColorKey[] = [
  'teal',
  'coral',
  'violet',
  'sky',
  'amber',
  'rose',
];

export const subjectIconKeys: readonly SubjectIconKey[] = [
  'calculator',
  'book',
  'flask',
  'globe',
  'palette',
  'language',
];

export interface SubjectColor {
  background: string;
  foreground: string;
}

/**
 * Cores das disciplinas. No tema claro o fundo é uma tinta suave com texto
 * escuro; no tema escuro o fundo é uma tinta profunda com texto claro.
 * `teal` e `coral` reaproveitam a marca.
 */
export const subjectColors: Record<ThemeMode, Record<SubjectColorKey, SubjectColor>> = {
  light: {
    teal: { background: '#CFF1EC', foreground: '#0B5E56' },
    coral: { background: '#FFDDD2', foreground: '#8A2E12' },
    violet: { background: '#E4DCFA', foreground: '#4B2FA0' },
    sky: { background: '#D3E8FA', foreground: '#12508A' },
    amber: { background: '#FFEBB8', foreground: '#7A4A00' },
    rose: { background: '#FADCE6', foreground: '#9B1C4B' },
  },
  dark: {
    teal: { background: '#0F3A36', foreground: brand.teal },
    coral: { background: '#4A2519', foreground: brand.coral },
    violet: { background: '#2E2556', foreground: '#B9A6FF' },
    sky: { background: '#17334F', foreground: '#7CC0FF' },
    amber: { background: '#463410', foreground: brand.highlighter },
    rose: { background: '#4A1F33', foreground: '#FF9BBE' },
  },
};
