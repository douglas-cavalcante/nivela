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
    // Rulings 4 e 6: derivado. Linha registrada; ou todas as questões ativas
    // terminadas no capítulo (questão desativada depois não trava o aluno); ou
    // capítulo vazio com o anterior concluído (mantém a ordem da RN06).
    const completed =
      chapter.recorded ||
      (chapter.total > 0 && chapter.answered >= chapter.total) ||
      (chapter.total === 0 && previousCompleted);
    const state: ChapterState = completed
      ? 'completed'
      : previousCompleted
        ? 'available'
        : 'locked';
    previousCompleted = completed;
    return { ...chapter, state, completed };
  });
}

/** O que o resolvedor precisa saber de um (aluno, plano). */
export interface PlanProgressInput {
  /** Capítulos do plano, já na ordem. */
  chapters: ChapterProgress[];
  /** Existe linha em `plan_completions`. */
  recorded: boolean;
  /** O aluno terminou ao menos uma tentativa num capítulo do plano (Ruling 9). */
  hasFinishedAttempt: boolean;
}

export interface ResolvedPlan {
  chapters: ResolvedChapter[];
  completed: boolean;
  recorded: boolean;
  /** Capítulos concluídos (derivados) ainda sem linha em `chapter_completions`. */
  pendingChapters: ResolvedChapter[];
  /** Plano concluído (derivado) ainda sem linha em `plan_completions`. */
  pendingPlan: boolean;
}

/**
 * Única regra de conclusão de plano (Rulings 4, 9 e 11), usada pelo aluno
 * (lista, detalhe, assentamento) e pela equipe (progresso, ficha): o plano
 * está concluído se já foi gravado ou se tem capítulos, todos concluídos, e o
 * aluno terminou ao menos uma tentativa num deles (desativar todas as
 * questões não paga bônus a quem nunca respondeu).
 */
export function resolvePlanState(input: PlanProgressInput): ResolvedPlan {
  const chapters = resolveChapterStates(input.chapters);
  const derived =
    chapters.length > 0 &&
    chapters.every((chapter) => chapter.completed) &&
    input.hasFinishedAttempt;
  const completed = input.recorded || derived;
  return {
    chapters,
    completed,
    recorded: input.recorded,
    pendingChapters: chapters.filter(
      (chapter) => chapter.completed && !chapter.recorded,
    ),
    pendingPlan: completed && !input.recorded,
  };
}

/** Percentual inteiro de 0 a 100; 0 quando não há capítulos. */
export function percentOf(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}
