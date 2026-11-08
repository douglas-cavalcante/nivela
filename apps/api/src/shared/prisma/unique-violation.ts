import { Prisma } from 'src/generated/prisma/client';

const UNIQUE_VIOLATION = 'P2002';

type Target = string | string[] | undefined;

function matches(target: Target, constraint: string): boolean {
  return Array.isArray(target)
    ? target.includes(constraint)
    : target === constraint;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
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

  const cause = asRecord(asRecord(meta.driverAdapterError)?.cause);
  const adapterConstraint = asRecord(cause?.constraint);
  return (
    matches(asTarget(adapterConstraint?.index), constraint) ||
    matches(asTarget(adapterConstraint?.fields), constraint)
  );
}
