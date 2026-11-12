import type { SubjectColorKey, SubjectIconKey } from '@nivela/design-tokens';

export type { SubjectColorKey, SubjectIconKey };

/** Disciplina como a API a devolve. */
export interface ApiSubject {
  id: number;
  name: string;
  color: SubjectColorKey;
  icon: SubjectIconKey;
  categories_count: number;
  questions_count: number;
}

/** Categoria como a API a devolve (sempre dentro de uma disciplina). */
export interface ApiCategory {
  id: number;
  name: string;
  subject: { id: number; name: string; color: SubjectColorKey };
  questions_count: number;
}
