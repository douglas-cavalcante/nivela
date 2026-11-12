import { Transform } from 'class-transformer';

/**
 * Remove espaços do início e do fim de textos (outros tipos passam intactos).
 * Com `emptyAsNull`, um texto que fica vazio vira `null` (campo opcional que
 * a pessoa limpou).
 */
export const Trim = (options: { emptyAsNull?: boolean } = {}) =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return options.emptyAsNull && trimmed === '' ? null : trimmed;
  });
