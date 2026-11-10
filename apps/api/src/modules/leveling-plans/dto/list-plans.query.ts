import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EmptyAsUndefined } from 'src/common/decorators/empty-as-undefined.decorator';
import { Trim } from 'src/common/decorators/trim.decorator';
import { PaginationQueryDto } from 'src/shared/pagination/pagination-query.dto';

const MAX_ID = 2_147_483_647;
export const PLAN_STATUSES = ['draft', 'published'] as const;

/** Query de `GET /plans`. */
export class ListPlansQuery extends PaginationQueryDto {
  /** Parte do título do plano. */
  @EmptyAsUndefined()
  @IsOptional()
  @Trim()
  @IsString({ message: 'A busca deve ser um texto.' })
  @MaxLength(120, { message: 'A busca deve ter no máximo 120 caracteres.' })
  search?: string;

  @EmptyAsUndefined()
  @IsOptional()
  @IsIn(PLAN_STATUSES, {
    message: 'A situação deve ser draft ou published.',
  })
  status?: (typeof PLAN_STATUSES)[number];

  @EmptyAsUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A disciplina deve ser um número inteiro.' })
  @Min(1, { message: 'A disciplina deve ser um número inteiro.' })
  @Max(MAX_ID, { message: 'A disciplina deve ser um número inteiro.' })
  subject_id?: number;
}
