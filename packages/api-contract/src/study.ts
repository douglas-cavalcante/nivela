import type { Difficulty, OptionLetter } from './questions';
import type { SubjectColorKey, SubjectIconKey } from './subjects';

/**
 * Questão como o aluno a vê: nunca traz a alternativa correta nem a explicação
 * (RN05). Esses dados só chegam em `ApiAnswerResult`, quando a questão termina.
 */
export interface ApiStudentQuestion {
  id: number;
  statement: string;
  /** Caminho relativo à raiz do servidor; resolva com `resolveAssetUrl`. */
  image_url: string | null;
  difficulty: Difficulty;
  subject: { id: number; name: string; color: SubjectColorKey };
  category: { id: number; name: string };
  options: Array<{ letter: OptionLetter; text: string }>;
  /** Tentativas que ainda restam no contexto (prática ou capítulo). */
  attempts_left: 1 | 2;
}

/** Disciplina da prática livre, com as questões ainda disponíveis para o aluno. */
export interface ApiPracticeSubject {
  id: number;
  name: string;
  color: SubjectColorKey;
  icon: SubjectIconKey;
  available_questions: number;
  categories: Array<{ id: number; name: string; available_questions: number }>;
}

/** Resposta de `GET /practice/next`: `question` é null quando o aluno terminou tudo. */
export interface ApiPracticeNext {
  question: ApiStudentQuestion | null;
  /** Questões ainda não terminadas, contando a atual. */
  remaining: number;
}

/** Corpo de `POST /answers`. */
export interface ApiAnswerPayload {
  question_id: number;
  selected_letter: OptionLetter;
  /** Ausente na prática livre. */
  plan_chapter_id?: number;
}

export interface ApiAnswerResult {
  is_correct: boolean;
  attempt_number: 1 | 2;
  /** Verdadeiro ao acertar ou ao esgotar as 2 tentativas. */
  finished: boolean;
  /** Moedas efetivamente creditadas por esta resposta (0 se já ganhou antes). */
  coins_awarded: number;
  coins_balance: number;
  /** Só quando `finished` (RN05). */
  correct_letter: OptionLetter | null;
  /** Só quando `finished` (RN05). */
  explanation: string | null;
  streak: { current: number; best: number; bonus_awarded: number };
  chapter?: { completed: boolean; next_chapter_id: number | null };
  plan?: { completed: boolean; bonus_awarded: number };
}

/** Resposta de `GET /me/stats`. */
export interface ApiStudentStats {
  coins_balance: number;
  current_streak: number;
  best_streak: number;
}
