import type { ApiAnswerResult, OptionLetter } from '@nivela/api-contract';

export interface AnswerOutcome {
  isCorrect: boolean;
  attemptNumber: 1 | 2;
  coinsAwarded: number;
  coinsBalance: number;
  correctLetter: string;
  explanation: string;
  streak: { current: number; best: number; bonus_awarded: number };
}

/** RN05: a correta e a explicação só saem quando a questão termina no contexto. */
export function presentAnswerResult(outcome: AnswerOutcome): ApiAnswerResult {
  const finished = outcome.isCorrect || outcome.attemptNumber === 2;
  return {
    is_correct: outcome.isCorrect,
    attempt_number: outcome.attemptNumber,
    finished,
    coins_awarded: outcome.coinsAwarded,
    coins_balance: outcome.coinsBalance,
    correct_letter: finished ? (outcome.correctLetter as OptionLetter) : null,
    explanation: finished ? outcome.explanation : null,
    streak: outcome.streak,
  } satisfies ApiAnswerResult;
}
