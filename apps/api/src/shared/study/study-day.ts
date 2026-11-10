/** Fuso do "dia de estudo": o dia vira à meia-noite de Fortaleza, em qualquer servidor. */
export const STUDY_TIME_ZONE = 'America/Fortaleza';

const MS_PER_DAY = 86_400_000;

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: STUDY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Dia de estudo (`YYYY-MM-DD`) do instante informado, em America/Fortaleza. */
export function studyDay(date: Date): string {
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Dias desde 1970-01-01 do dia `YYYY-MM-DD` (dias consecutivos diferem em 1). */
export function dayNumber(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / MS_PER_DAY);
}
