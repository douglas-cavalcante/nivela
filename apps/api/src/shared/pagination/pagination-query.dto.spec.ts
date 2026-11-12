import { UnprocessableEntityException } from '@nestjs/common';
import { createValidationPipe } from 'src/common/pipes/validation.pipe';
import { PaginationQueryDto } from 'src/shared/pagination/pagination-query.dto';

const pipe = createValidationPipe();

function validate(query: Record<string, unknown>) {
  return pipe.transform(query, { type: 'query', metatype: PaginationQueryDto });
}

async function errorsOf(query: Record<string, unknown>) {
  try {
    await validate(query);
  } catch (error) {
    expect(error).toBeInstanceOf(UnprocessableEntityException);
    return (error as UnprocessableEntityException).getResponse() as {
      errors: Record<string, string[]>;
    };
  }
  throw new Error('era esperado um erro de validação');
}

describe('PaginationQueryDto', () => {
  it('aplica os padrões (página 1, 15 por página)', async () => {
    await expect(validate({})).resolves.toMatchObject({
      page: 1,
      per_page: 15,
    });
  });

  it('converte os textos da query string em números', async () => {
    await expect(
      validate({ page: '3', per_page: '50' }),
    ).resolves.toMatchObject({ page: 3, per_page: 50 });
  });

  it('aceita per_page de 1 a 100', async () => {
    await expect(validate({ per_page: '1' })).resolves.toMatchObject({
      per_page: 1,
    });
    await expect(validate({ per_page: '100' })).resolves.toMatchObject({
      per_page: 100,
    });
  });

  it('recusa página menor que 1 ou não numérica, em pt-BR', async () => {
    expect((await errorsOf({ page: '0' })).errors.page).toEqual([
      'A página deve ser no mínimo 1.',
    ]);
    expect((await errorsOf({ page: 'abc' })).errors.page).toContain(
      'A página deve ser um número inteiro.',
    );
  });

  it('recusa per_page fora de 1–100, em pt-BR', async () => {
    expect((await errorsOf({ per_page: '0' })).errors.per_page).toEqual([
      'A quantidade por página deve ser no mínimo 1.',
    ]);
    expect((await errorsOf({ per_page: '101' })).errors.per_page).toEqual([
      'A quantidade por página deve ser no máximo 100.',
    ]);
    expect((await errorsOf({ per_page: '2.5' })).errors.per_page).toEqual([
      'A quantidade por página deve ser um número inteiro.',
    ]);
  });
});
