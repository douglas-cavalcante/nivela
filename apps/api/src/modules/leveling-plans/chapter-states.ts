import type { ChapterState } from '@nivela/api-contract';

/** Capítulo de um plano, na ordem, com o que o aluno já fez nele. */
export interface ChapterProgress {
  id: number;
  title: string;
  position: number;
  /** Questões ativas do capítulo. */
  total: number;
  /** Questões ativas que o aluno terminou neste capítulo. */
  answered: number;
  /** Existe linha em `chapter_completions`. */
  recorded: boolean;
}

export interface ResolvedChapter extends ChapterProgress {
  state: ChapterState;
  completed: boolean;
}

/**
 * RN06 + Ruling 4: um capítulo está concluído se tem linha de conclusão ou
 * nenhuma questão ativa (não trava o aluno); o capítulo N+1 só fica
 * disponível quando o N está concluído. O primeiro nunca é trancado.
 * `chapters` já vem ordenado por posição.
 */
export function resolveChapterStates(
  chapters: ChapterProgress[],
): ResolvedChapter[] {
  let previousCompleted = true;
  return chapters.map((chapter) => {
    const completed = chapter.recorded || chapter.total === 0;
    const state: ChapterState = completed
      ? 'completed'
      : previousCompleted
        ? 'available'
        : 'locked';
    previousCompleted = completed;
    return { ...chapter, state, completed };
  });
}

/** Percentual inteiro de 0 a 100; 0 quando não há capítulos. */
export function percentOf(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}
