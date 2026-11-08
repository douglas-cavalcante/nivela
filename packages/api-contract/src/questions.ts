import type { SubjectColorKey } from './subjects';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E';

/** Questão como aparece na listagem (enunciado resumido). */
export interface ApiQuestionSummary {
  id: number;
  /** Primeiros 140 caracteres do enunciado, sem quebras de linha. */
  statement_excerpt: string;
  difficulty: Difficulty;
  active: boolean;
  has_image: boolean;
  subject: { id: number; name: string; color: SubjectColorKey };
  category: { id: number; name: string };
  author: { id: number; name: string };
  updated_at: string;
}

/** Questão completa, com as 5 alternativas e a correta. */
export interface ApiQuestion
  extends Omit<ApiQuestionSummary, 'statement_excerpt' | 'has_image'> {
  statement: string;
  explanation: string;
  image_url: string | null;
  correct_letter: OptionLetter;
  options: Array<{ letter: OptionLetter; text: string }>;
  /** Verdadeiro para o autor e para administradores. */
  can_edit: boolean;
  created_at: string;
}

/** Corpo de `POST /questions` e `PUT /questions/:id`. */
export interface QuestionPayload {
  subject_id: number;
  category_id: number;
  statement: string;
  difficulty: Difficulty;
  explanation: string;
  options: Array<{ letter: OptionLetter; text: string }>;
  correct_letter: OptionLetter;
}
