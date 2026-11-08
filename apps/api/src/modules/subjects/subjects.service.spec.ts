import { NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { SubjectsService } from 'src/modules/subjects/subjects.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';

const dto = { name: 'Matemática', color: 'teal', icon: 'calculator' } as const;

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Matemática',
  color: 'teal',
  icon: 'calculator',
  _count: { categories: 2 },
  ...overrides,
});

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('falha', {
    code,
    clientVersion: 'teste',
    meta,
  });
}

describe('SubjectsService', () => {
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const del = jest.fn();
  const service = new SubjectsService({
    subject: { findMany, findUnique, create, update, delete: del },
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('lista com a contagem de categorias e questões zerada', async () => {
    findMany.mockResolvedValue([row()]);

    await expect(service.list()).resolves.toEqual([
      {
        id: 1,
        name: 'Matemática',
        color: 'teal',
        icon: 'calculator',
        categories_count: 2,
        questions_count: 0,
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } }),
    );
  });

  it('traduz a violação do índice único para 422 no nome', async () => {
    create.mockRejectedValue(
      knownError('P2002', {
        driverAdapterError: {
          cause: { constraint: { index: 'subjects_name_key' } },
        },
      }),
    );

    const error = await service.create(dto).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FieldValidationException);
    expect((error as FieldValidationException).getResponse()).toMatchObject({
      errors: { name: ['Já existe uma disciplina com esse nome.'] },
    });
  });

  it('repassa erros inesperados', async () => {
    const boom = new Error('boom');
    create.mockRejectedValue(boom);
    await expect(service.create(dto)).rejects.toBe(boom);
  });

  it('update de id inexistente (P2025) → 404', async () => {
    update.mockRejectedValue(knownError('P2025'));
    await expect(service.update(9, dto)).rejects.toThrow(
      new NotFoundException('Disciplina não encontrada.'),
    );
  });

  it('remove: 404 quando não existe', async () => {
    findUnique.mockResolvedValue(null);
    await expect(service.remove(9)).rejects.toBeInstanceOf(NotFoundException);
    expect(del).not.toHaveBeenCalled();
  });

  it('remove: 409 quando tem categorias, sem excluir', async () => {
    findUnique.mockResolvedValue(row());
    await expect(service.remove(1)).rejects.toThrow(
      new BusinessRuleException(
        'Não é possível excluir: a disciplina tem categorias ou questões.',
      ),
    );
    expect(del).not.toHaveBeenCalled();
  });

  it('remove: 409 também quando a chave estrangeira barra a exclusão (corrida)', async () => {
    findUnique.mockResolvedValue(row({ _count: { categories: 0 } }));
    del.mockRejectedValue(knownError('P2003'));
    await expect(service.remove(1)).rejects.toBeInstanceOf(
      BusinessRuleException,
    );
  });

  it('remove: exclui quando está livre', async () => {
    findUnique.mockResolvedValue(row({ _count: { categories: 0 } }));
    del.mockResolvedValue(undefined);
    await expect(service.remove(1)).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
