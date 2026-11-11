const EXCERPT_LENGTH = 140;

/** Primeiros 140 caracteres do enunciado, sem quebras de linha. */
export function statementExcerpt(statement: string): string {
  const flat = statement.replace(/\s*[\r\n]+\s*/g, ' ');
  // Por pontos de código, para não partir emojis ao meio.
  const chars = Array.from(flat);
  return chars.length > EXCERPT_LENGTH
    ? `${chars.slice(0, EXCERPT_LENGTH).join('').trimEnd()}…`
    : flat;
}
