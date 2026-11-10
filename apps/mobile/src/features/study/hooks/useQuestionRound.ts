import type { ApiStudentQuestion } from '@nivela/api-contract';
import { useState } from 'react';

/**
 * Uma "rodada" de uma questão: depois de errar na 1ª tentativa o aluno tenta de novo a MESMA
 * questão, agora com `attempts_left` 1, sem buscar outra. `next` volta ao estado inicial
 * (use junto da busca da próxima questão). Reutilizado pela prática e pelos planos.
 */
export function useQuestionRound(base: ApiStudentQuestion | null) {
  const [retried, setRetried] = useState(false);
  const question: ApiStudentQuestion | null = base && retried ? { ...base, attempts_left: 1 } : base;
  return {
    question,
    retried,
    /** Marca a 2ª tentativa da mesma questão. */
    retry: () => setRetried(true),
    /** Zera para a próxima questão. */
    reset: () => setRetried(false),
  };
}
