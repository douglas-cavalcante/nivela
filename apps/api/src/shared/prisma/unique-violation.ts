import { Prisma } from 'src/generated/prisma/client';
import { adapterConstraint, asRecord } from 'src/shared/prisma/prisma-error';

const UNIQUE_VIOLATION = 'P2002';

type Target = string | string[] | undefined;

function matches(target: Target, constraint: string): boolean {
  return Array.isArray(target)
    ? target.includes(constraint)
    : target === constraint;
}

function asTarget(value: unknown): Target {
  if (typeof value === 'string') {
    return value;
  }
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined;
}

/**
 * Verdadeiro se `error` é uma violação de unicidade (P2002) da restrição
 * informada — pelo nome do índice (`users_email_key`) ou pela coluna
 * (`email`). Lê o `meta` estruturalmente:
 * - driver adapter (Prisma 7 + adapter-pg):
 *   `meta.driverAdapterError.cause.constraint.index` ou `.fields`;
 * - formato clássico: `meta.target` (texto ou lista).
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== UNIQUE_VIOLATION
  ) {
    return false;
  }
  const meta = asRecord(error.meta);
  if (!meta) {
    return false;
  }
  if (matches(asTarget(meta.target), constraint)) {
    return true;
  }

  const adapter = adapterConstraint(meta);
  return (
    matches(asTarget(adapter?.index), constraint) ||
    matches(asTarget(adapter?.fields), constraint)
  );
}
