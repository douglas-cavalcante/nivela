import { Prisma } from 'src/generated/prisma/client';

/** Registro não encontrado (update/delete de id inexistente). */
export const RECORD_NOT_FOUND = 'P2025';
/** Violação de chave estrangeira (ex.: apagar registro referenciado). */
export const FOREIGN_KEY_VIOLATION = 'P2003';

/** Verdadeiro se `error` é um erro conhecido do Prisma com o código informado. */
export function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}
