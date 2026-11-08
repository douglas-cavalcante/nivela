import { NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { CategoriesService } from 'src/modules/categories/categories.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';

const row = {
  id: 4,
  name: 'Frações',
  subject: { id: 1, name: 'Matemática', color: 'violet' },
};

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('falha', {
    code,
    clientVersion: 'teste',
    meta,
  });
}

describe('CategoriesService', () => {
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const del = jest.fn();
  const service = new CategoriesService({
    category: { findMany, findUnique, create, update, delete: del },
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('lista filtrando por disciplina, com questões zeradas', async () => {
    findMany.mockResolvedValue([row]);

    await expect(service.list(1)).resolves.toEqual([
      {
        id: 4,
        name: 'Frações',
        subject: { id: 1, name: 'Matemática', color: 'violet' },
        questions_count: 0,
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { subjectId: 1 } }),
    );
  });

  it('lista sem filtro quando não há subject_id', async () => {
    findMany.mockResolvedValue([]);
    await service.list();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('traduz a violação do índice único para 422 no nome', async () => {
    create.mockRejectedValue(
      knownError('P2002', {
        driverAdapterError: {
          cause: { constraint: { index: 'categories_subject_name_key' } },
        },
      }),
    );

    const error = await service
      .create({ subject_id: 1, name: 'Frações' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FieldValidationException);
    expect((error as FieldValidationException).getResponse()).toMatchObject({
      errors: {
        name: ['Já existe uma categoria com esse nome nessa disciplina.'],
      },
    });
  });

  it('criar com disciplina que sumiu (P2003) → 422 em subject_id', async () => {
    create.mockRejectedValue(knownError('P2003'));
    const error = await service
      .create({ subject_id: 99, name: 'Frações' })
      .catch((e: unknown) => e);
    expect((error as FieldValidationException).getResponse()).toMatchObject({
      errors: { subject_id: ['Disciplina não encontrada.'] },
    });
  });

  it('update de id inexistente (P2025) → 404', async () => {
    update.mockRejectedValue(knownError('P2025'));
    await expect(service.update(9, { name: 'Nova' })).rejects.toThrow(
      new NotFoundException('Categoria não encontrada.'),
    );
  });

  it('remove: 404 quando não existe; exclui quando existe e está livre', async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(service.remove(9)).rejects.toBeInstanceOf(NotFoundException);

    findUnique.mockResolvedValueOnce({ id: 4 });
    del.mockResolvedValue(undefined);
    await expect(service.remove(4)).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith({ where: { id: 4 } });
  });

  it('remove: 409 quando a chave estrangeira barra a exclusão', async () => {
    findUnique.mockResolvedValue({ id: 4 });
    del.mockRejectedValue(knownError('P2003'));
    await expect(service.remove(4)).rejects.toThrow(
      'Não é possível excluir: a categoria tem questões.',
    );
  });
});
