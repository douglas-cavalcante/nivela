import { Transform } from 'class-transformer';

/** Normaliza o e-mail do DTO: remove espaços das pontas e converte para minúsculas. */
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
