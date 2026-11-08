import { NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { TokenService } from 'src/modules/auth/token.service';
import { TeachersService } from 'src/modules/teachers/teachers.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Maria',
  email: 'maria@escola.test',
  active: true,
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  _count: { classrooms: 3 },
  ...overrides,
});

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('falha', {
    code,
    clientVersion: 'teste',
    meta,
  });
}

describe('TeachersService', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const revokeOthers = jest.fn();
  const tx = { user: { update } };
  const $transaction = jest.fn((fn: (client: typeof tx) => unknown) => fn(tx));
  const service = new TeachersService(
    {
      user: { findMany, count, create, update },
      $transaction,
    } as unknown as PrismaService,
    { revokeOthers } as unknown as TokenService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    $transaction.mockImplementation((fn: (client: typeof tx) => unknown) =>
      fn(tx),
    );
  });

  it('lista apenas professores, por nome, apresentando o contrato', async () => {
    findMany.mockResolvedValue([row()]);
    count.mockResolvedValue(1);

    const result = await service.list({
      page: 1,
      per_page: 15,
      search: 'mar',
      status: 'active',
    });

    expect(result).toEqual({
      data: [
        {
          id: 1,
          name: 'Maria',
          email: 'maria@escola.test',
          active: true,
          classrooms_count: 3,
          created_at: '2026-01-02T03:04:05.000Z',
        },
      ],
      meta: { page: 1, per_page: 15, total: 1, last_page: 1 },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: 'teacher',
          active: true,
          OR: [
            { name: { contains: 'mar', mode: 'insensitive' } },
            { email: { contains: 'mar', mode: 'insensitive' } },
          ],
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: 0,
        take: 15,
      }),
    );
  });

  it('create: traduz e-mail duplicado em 422 no campo email', async () => {
    create.mockRejectedValue(
      knownError('P2002', {
        driverAdapterError: {
          cause: { constraint: { index: 'users_email_key' } },
        },
      }),
    );

    const error = await service
      .create({
        name: 'Maria',
        email: 'maria@escola.test',
        password: 'segredo123',
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FieldValidationException);
    expect((error as FieldValidationException).getResponse()).toMatchObject({
      errors: { email: ['Este e-mail já está cadastrado.'] },
    });
  });

  it('update: P2025 (não é professor / não existe) → 404', async () => {
    update.mockRejectedValue(knownError('P2025'));
    await expect(
      service.update(9, { name: 'Maria', email: 'maria@escola.test' }),
    ).rejects.toThrow(new NotFoundException('Professor não encontrado.'));
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 9, role: 'teacher' } }),
    );
  });

  it('desativar revoga todas as sessões na mesma transação', async () => {
    update.mockResolvedValue(row({ active: false }));

    const result = await service.setStatus(1, false);

    expect(result.active).toBe(false);
    expect(revokeOthers).toHaveBeenCalledWith(1, undefined, tx);
  });

  it('reativar não mexe nas sessões', async () => {
    update.mockResolvedValue(row());
    await service.setStatus(1, true);
    expect(revokeOthers).not.toHaveBeenCalled();
  });

  it('setStatus: P2025 → 404 sem revogar', async () => {
    update.mockRejectedValue(knownError('P2025'));
    await expect(service.setStatus(9, false)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(revokeOthers).not.toHaveBeenCalled();
  });

  it('resetPassword grava o hash e revoga todas as sessões na transação', async () => {
    update.mockResolvedValue(row());

    await service.resetPassword(1, 'novasenha1');

    const { data, where } = update.mock.calls[0][0] as {
      data: { password: string };
      where: unknown;
    };
    expect(where).toEqual({ id: 1, role: 'teacher' });
    expect(data.password).toMatch(/^\$2[aby]\$/);
    expect(data.password).not.toContain('novasenha1');
    expect(revokeOthers).toHaveBeenCalledWith(1, undefined, tx);
  });

  it('resetPassword: P2025 → 404', async () => {
    update.mockRejectedValue(knownError('P2025'));
    await expect(service.resetPassword(9, 'novasenha1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
