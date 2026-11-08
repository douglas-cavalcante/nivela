import { Prisma } from 'src/generated/prisma/client';
import {
  FOREIGN_KEY_VIOLATION,
  hasPrismaCode,
  RECORD_NOT_FOUND,
} from 'src/shared/prisma/prisma-error';

const known = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('falha', {
    code,
    clientVersion: 'teste',
  });

describe('hasPrismaCode', () => {
  it('reconhece o código do erro conhecido do Prisma', () => {
    expect(hasPrismaCode(known('P2025'), RECORD_NOT_FOUND)).toBe(true);
    expect(hasPrismaCode(known('P2003'), FOREIGN_KEY_VIOLATION)).toBe(true);
  });

  it('ignora outros códigos e erros que não são do Prisma', () => {
    expect(hasPrismaCode(known('P2002'), RECORD_NOT_FOUND)).toBe(false);
    expect(hasPrismaCode(new Error('P2025'), RECORD_NOT_FOUND)).toBe(false);
    expect(hasPrismaCode(undefined, RECORD_NOT_FOUND)).toBe(false);
  });
});
