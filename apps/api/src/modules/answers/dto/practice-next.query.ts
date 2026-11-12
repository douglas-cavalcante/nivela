import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { EmptyAsUndefined } from 'src/common/decorators/empty-as-undefined.decorator';

/** Maior valor de uma coluna INTEGER do PostgreSQL. */
const MAX_ID = 2_147_483_647;

/** Query de `GET /practice/next`. */
export class PracticeNextQuery {
  @EmptyAsUndefined()
  @Type(() => Number)
  @IsInt({ message: 'Escolha uma disciplina.' })
  @Min(1, { message: 'Escolha uma disciplina.' })
  @Max(MAX_ID, { message: 'Escolha uma disciplina.' })
  subject_id: number;

  @EmptyAsUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A categoria deve ser um número inteiro.' })
  @Min(1, { message: 'A categoria deve ser um número inteiro.' })
  @Max(MAX_ID, { message: 'A categoria deve ser um número inteiro.' })
  category_id?: number;
}
