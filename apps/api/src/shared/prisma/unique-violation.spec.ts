import { Prisma } from 'src/generated/prisma/client';
import { isUniqueViolation } from 'src/shared/prisma/unique-violation';

function knownError(code: string, meta: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('falha', {
    code,
    clientVersion: 'teste',
    meta,
  });
}

/** Formato real do Prisma 7 com @prisma/adapter-pg (capturado do Postgres). */
function adapterError(constraint: Record<string, unknown>, code = 'P2002') {
  return knownError(code, {
    modelName: 'User',
    driverAdapterError: {
      name: 'DriverAdapterError',
      cause: {
        originalCode: '23505',
        kind: 'UniqueConstraintViolation',
        constraint,
        table: 'users',
      },
    },
  });
}

describe('isUniqueViolation', () => {
  it('reconhece o formato do driver adapter (constraint.index)', () => {
    const error = adapterError({ index: 'users_email_key' });
    expect(isUniqueViolation(error, 'users_email_key')).toBe(true);
    expect(isUniqueViolation(error, 'access_tokens_token_hash_key')).toBe(
      false,
    );
  });

  it('reconhece o formato do driver adapter (constraint.fields)', () => {
    const error = adapterError({ fields: ['email'] });
    expect(isUniqueViolation(error, 'email')).toBe(true);
    expect(isUniqueViolation(error, 'token_hash')).toBe(false);
  });

  it('reconhece meta.target como texto (nome da restrição)', () => {
    const error = knownError('P2002', { target: 'users_email_key' });
    expect(isUniqueViolation(error, 'users_email_key')).toBe(true);
    expect(isUniqueViolation(error, 'users_email')).toBe(false);
  });

  it('reconhece meta.target como lista', () => {
    const error = knownError('P2002', { target: ['email'] });
    expect(isUniqueViolation(error, 'email')).toBe(true);
    expect(isUniqueViolation(error, 'name')).toBe(false);
  });

  it('não confunde com nome que só aparece em outro campo do meta', () => {
    const error = knownError('P2002', {
      modelName: 'users_email_key',
      target: ['token_hash'],
    });
    expect(isUniqueViolation(error, 'users_email_key')).toBe(false);
  });

  it('ignora outros códigos e erros que não são do Prisma', () => {
    expect(
      isUniqueViolation(
        adapterError({ index: 'users_email_key' }, 'P2003'),
        'users_email_key',
      ),
    ).toBe(false);
    expect(
      isUniqueViolation(new Error('users_email_key'), 'users_email_key'),
    ).toBe(false);
    expect(isUniqueViolation(null, 'users_email_key')).toBe(false);
  });
});
