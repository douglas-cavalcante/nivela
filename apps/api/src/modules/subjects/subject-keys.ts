import type { SubjectColorKey, SubjectIconKey } from '@nivela/api-contract';

// A API só pode importar tipos de @nivela/api-contract e não usa
// @nivela/design-tokens em tempo de execução: as listas ficam aqui e o
// compilador garante que cobrem exatamente as uniões do contrato.

export const SUBJECT_COLOR_KEYS = [
  'teal',
  'coral',
  'violet',
  'sky',
  'amber',
  'rose',
] as const satisfies readonly SubjectColorKey[];

export const SUBJECT_ICON_KEYS = [
  'calculator',
  'book',
  'flask',
  'globe',
  'palette',
  'language',
] as const satisfies readonly SubjectIconKey[];

/** Erro de compilação se `Missing` não for `never` (faltou alguma chave). */
type AssertCovered<Missing extends never> = Missing;
export type ColorKeysCoverContract = AssertCovered<
  Exclude<SubjectColorKey, (typeof SUBJECT_COLOR_KEYS)[number]>
>;
export type IconKeysCoverContract = AssertCovered<
  Exclude<SubjectIconKey, (typeof SUBJECT_ICON_KEYS)[number]>
>;
