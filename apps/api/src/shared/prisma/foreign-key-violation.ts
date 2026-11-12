import { Prisma } from 'src/generated/prisma/client';
import {
  adapterConstraint,
  asRecord,
  FOREIGN_KEY_VIOLATION,
} from 'src/shared/prisma/prisma-error';

/**
 * Verdadeiro se `error` é uma violação de chave estrangeira (P2003) da
 * restrição informada (ex.: `questions_subject_id_fkey`). Lê o `meta`
 * estruturalmente:
 * - driver adapter (Prisma 7 + adapter-pg):
 *   `meta.driverAdapterError.cause.constraint.index`;
 * - formato clássico: `meta.field_name` (`<restrição>` ou `<restrição> (index)`).
 */
export function isForeignKeyViolation(
  error: unknown,
  constraint: string,
): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== FOREIGN_KEY_VIOLATION
  ) {
    return false;
  }
  const meta = asRecord(error.meta);
  if (!meta) {
    return false;
  }
  if (adapterConstraint(meta)?.index === constraint) {
    return true;
  }
  const fieldName = meta.field_name;
  return (
    typeof fieldName === 'string' &&
    fieldName.replace(/ \(index\)$/, '') === constraint
  );
}
