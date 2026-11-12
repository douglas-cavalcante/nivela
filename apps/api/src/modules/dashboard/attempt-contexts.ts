import { Prisma } from 'src/generated/prisma/client';
import { dayNumber, studyDay } from 'src/shared/study/study-day';
import { studyDaySql } from 'src/shared/study/study-day.sql';

/** Janela dos indicadores do Início, em dias de estudo (hoje e os 29 anteriores). */
export const WINDOW_DAYS = 30;
/** Mínimo de questões terminadas na janela para um aluno contar como "precisa de ajuda". */
export const HELP_MIN_FINISHED = 5;
/** Abaixo desta taxa (exclusive, em %) o aluno precisa de ajuda. */
export const HELP_ACCURACY_BELOW = 50;

/** `YYYY-MM-DD` do dia de estudo `offset` dias depois de `day`. */
export function shiftDay(day: string, offset: number): string {
  return new Date((dayNumber(day) + offset) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Primeiro e último dia (hoje) da janela de 30 dias, em dias de estudo. */
export function windowBounds(now: Date): { from: string; to: string } {
  const to = studyDay(now);
  return { from: shiftDay(to, -(WINDOW_DAYS - 1)), to };
}

/** Porcentagem inteira de acerto; `null` sem questões terminadas. */
export function accuracyOf(correct: number, finished: number): number | null {
  return finished === 0 ? null : Math.round((correct * 100) / finished);
}

/**
 * CTE `contexts`: uma linha por (aluno, questão, contexto), onde contexto é o
 * capítulo do plano ou a prática (`plan_chapter_id` nulo). Terminada = houve
 * acerto ou 2ª tentativa (`finished_at` preenchido, com o instante em que
 * terminou); correta = houve acerto. Nunca conta tentativas.
 */
export function contextsCte(studentIds: number[]): Prisma.Sql {
  return Prisma.sql`contexts AS (
    SELECT qa.student_id, qa.question_id, qa.plan_chapter_id,
      bool_or(qa.is_correct) AS correct,
      min(qa.created_at) FILTER (
        WHERE qa.is_correct OR qa.attempt_number = 2
      ) AS finished_at
    FROM question_attempts qa
    WHERE qa.student_id = ANY(${studentIds}::int[])
    GROUP BY qa.student_id, qa.question_id, qa.plan_chapter_id
  )`;
}

/** Condição sobre `c`: terminada dentro da janela `[from, to]` (dias de estudo). */
export function finishedWithin(from: string, to: string): Prisma.Sql {
  const day = studyDaySql('c.finished_at');
  return Prisma.sql`c.finished_at IS NOT NULL
    AND ${day} >= ${from}::date AND ${day} <= ${to}::date`;
}
