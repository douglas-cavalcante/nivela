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

/** `value` como objeto indexável, ou `undefined` (para ler o `meta` dos erros). */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

/** `meta.driverAdapterError.cause.constraint` do Prisma 7 com adapter-pg. */
export function adapterConstraint(
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const cause = asRecord(asRecord(meta.driverAdapterError)?.cause);
  return asRecord(cause?.constraint);
}
