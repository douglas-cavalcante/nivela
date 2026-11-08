import { Transform } from 'class-transformer';

/**
 * Parâmetro de query vazio (`?subject_id=` ou só espaços) vale como ausente.
 * Olha o valor original da requisição (`obj[key]`), então funciona junto com
 * `@Type(() => Number)`, que converteria `''` em `0`. Use em todo campo das
 * DTOs de listagem.
 */
export const EmptyAsUndefined = () =>
  Transform(
    ({ value, obj, key }: { value: unknown; obj: unknown; key: string }) => {
      const raw = (obj as Record<string, unknown>)[key];
      return typeof raw === 'string' && raw.trim() === '' ? undefined : value;
    },
  );
