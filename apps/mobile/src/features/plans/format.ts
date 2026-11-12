/** Lê um id de rota; `undefined` se vier vazio ou inválido. */
export function toId(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return raw && Number.isInteger(id) && id > 0 ? id : undefined;
}

/** "2026-11-20" (ou ISO completo) vira "20/11", sem passar por fuso horário. */
export function formatDueDay(dueDate: string): string {
  const [, month, day] = dueDate.slice(0, 10).split('-');
  return `${day}/${month}`;
}

export const chaptersLabel = (done: number, total: number): string => `${done} de ${total} capítulos`;
export const questionsLabel = (done: number, total: number): string => `${done} de ${total} questões`;
