import { UnprocessableEntityException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { EmptyAsUndefined } from 'src/common/decorators/empty-as-undefined.decorator';
import { createValidationPipe } from 'src/common/pipes/validation.pipe';

const pipe = createValidationPipe();

class SampleQuery {
  @EmptyAsUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'inteiro' })
  @Min(1, { message: 'mínimo' })
  id?: number;

  @EmptyAsUndefined()
  @IsOptional()
  @IsIn(['a', 'b'], { message: 'a ou b' })
  kind?: string;
}

const validate = (metatype: new () => object, query: Record<string, unknown>) =>
  pipe.transform(query, { type: 'query', metatype });

describe('@EmptyAsUndefined', () => {
  it('parâmetro vazio (ou só espaços) vira ausente, inclusive com @Type(Number)', async () => {
    const result = await validate(SampleQuery, { id: '', kind: '  ' });
    expect(result).toMatchObject({ id: undefined, kind: undefined });
  });

  it('valores preenchidos seguem a conversão e a validação normais', async () => {
    await expect(
      validate(SampleQuery, { id: '3', kind: 'b' }),
    ).resolves.toMatchObject({ id: 3, kind: 'b' });
    await expect(validate(SampleQuery, { id: '0' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    await expect(validate(SampleQuery, { kind: 'c' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
