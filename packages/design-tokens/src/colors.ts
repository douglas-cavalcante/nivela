export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  /** papel, cartão, pauta */
  background: string;
  surface: string;
  rule: string;
  text: string;
  textMuted: string;
  border: string;
  shadow: string;
  /** ação principal (turquesa) */
  primary: string;
  onPrimary: string;
  /** coral */
  secondary: string;
  onSecondary: string;
  /** marca-texto */
  highlight: string;
  onHighlight: string;
  danger: string;
  onDanger: string;
  success: string;
  onSuccess: string;
}

export const brand = {
  ink: '#23313F',
  teal: '#1FB5A6',
  tealDark: '#0E7C72',
  coral: '#FF7A59',
  highlighter: '#FFD86B',
  paper: '#FFFDF6',
  rule: '#E6EEF5',
  muted: '#5B6B7A',
} as const;

const light: ThemeColors = {
  background: brand.paper,
  surface: '#FFFFFF',
  rule: brand.rule,
  text: brand.ink,
  textMuted: brand.muted,
  border: brand.ink,
  shadow: brand.ink,
  primary: brand.tealDark,
  onPrimary: '#FFFFFF',
  secondary: brand.coral,
  onSecondary: brand.ink,
  highlight: brand.highlighter,
  onHighlight: brand.ink,
  danger: '#B42318',
  onDanger: '#FFFFFF',
  success: '#15803D',
  onSuccess: '#FFFFFF',
};

/** "Papel noturno": fundo azul-tinta, texto quente, mesmos destaques. */
const dark: ThemeColors = {
  background: '#141D29',
  surface: '#1D2938',
  rule: '#223142',
  text: '#F4EEDF',
  textMuted: '#A9B8C6',
  border: '#F4EEDF',
  shadow: '#0A1017',
  primary: brand.teal,
  onPrimary: '#0B1620',
  secondary: brand.coral,
  onSecondary: '#1B1210',
  highlight: brand.highlighter,
  onHighlight: brand.ink,
  danger: '#F97066',
  onDanger: '#1F0B09',
  success: '#4ADE80',
  onSuccess: '#08210F',
};

export const themes: Record<ThemeMode, ThemeColors> = { light, dark };
