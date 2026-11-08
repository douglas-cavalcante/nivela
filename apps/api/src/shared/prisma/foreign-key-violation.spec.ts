import { Prisma } from 'src/generated/prisma/client';
import { isForeignKeyViolation } from 'src/shared/prisma/foreign-key-violation';

function knownError(code: string, meta: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('falha', {
    code,
    clientVersion: 'teste',
    meta,
  });
}

/** Formato real do Prisma 7 com @prisma/adapter-pg (capturado do Postgres). */
function adapterError(index: string, code = 'P2003') {
  return knownError(code, {
    modelName: 'Question',
    driverAdapterError: {
      name: 'DriverAdapterError',
      cause: {
        originalCode: '23503',
        kind: 'ForeignKeyConstraintViolation',
        constraint: { index },
      },
    },
  });
}

describe('isForeignKeyViolation', () => {
  it('reconhece o formato do driver adapter (constraint.index)', () => {
    const error = adapterError('questions_subject_id_fkey');
    expect(isForeignKeyViolation(error, 'questions_subject_id_fkey')).toBe(
      true,
    );
    expect(isForeignKeyViolation(error, 'questions_category_id_fkey')).toBe(
      false,
    );
  });

  it('reconhece meta.field_name do formato clássico (com ou sem " (index)")', () => {
    expect(
      isForeignKeyViolation(
        knownError('P2003', {
          field_name: 'questions_category_id_fkey (index)',
        }),
        'questions_category_id_fkey',
      ),
    ).toBe(true);
    expect(
      isForeignKeyViolation(
        knownError('P2003', { field_name: 'questions_category_id_fkey' }),
        'questions_category_id_fkey',
      ),
    ).toBe(true);
    expect(
      isForeignKeyViolation(
        knownError('P2003', { field_name: 'questions_author_id_fkey (index)' }),
        'questions_category_id_fkey',
      ),
    ).toBe(false);
  });

  it('não confunde com nome que só aparece em outro campo do meta', () => {
    const error = knownError('P2003', {
      modelName: 'questions_subject_id_fkey',
      field_name: 'questions_author_id_fkey (index)',
    });
    expect(isForeignKeyViolation(error, 'questions_subject_id_fkey')).toBe(
      false,
    );
  });

  it('ignora outros códigos, meta ausente e erros que não são do Prisma', () => {
    expect(
      isForeignKeyViolation(
        adapterError('questions_subject_id_fkey', 'P2002'),
        'questions_subject_id_fkey',
      ),
    ).toBe(false);
    expect(
      isForeignKeyViolation(
        new Prisma.PrismaClientKnownRequestError('falha', {
          code: 'P2003',
          clientVersion: 'teste',
        }),
        'questions_subject_id_fkey',
      ),
    ).toBe(false);
    expect(
      isForeignKeyViolation(
        new Error('questions_subject_id_fkey'),
        'questions_subject_id_fkey',
      ),
    ).toBe(false);
    expect(isForeignKeyViolation(undefined, 'questions_subject_id_fkey')).toBe(
      false,
    );
  });
});
