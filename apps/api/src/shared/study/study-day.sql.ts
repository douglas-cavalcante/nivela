import { Prisma } from 'src/generated/prisma/client';
import { STUDY_TIME_ZONE } from 'src/shared/study/study-day';

/**
 * Fragmento SQL do dia de estudo de uma coluna `timestamptz`: o mesmo dia que
 * `studyDay` calcula em JS (America/Fortaleza). Toda agregação por dia usa
 * este fragmento, para que o SQL e o código nunca discordem na virada do dia.
 *
 * `column` é um identificador interno escrito no código (ex.: `qa.created_at`),
 * nunca um valor vindo do usuário.
 */
export function studyDaySql(column: string): Prisma.Sql {
  if (!/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)*$/i.test(column)) {
    throw new Error(`Identificador de coluna inválido: ${column}`);
  }
  return Prisma.sql`((${Prisma.raw(column)}) AT TIME ZONE ${Prisma.raw(`'${STUDY_TIME_ZONE}'`)})::date`;
}
