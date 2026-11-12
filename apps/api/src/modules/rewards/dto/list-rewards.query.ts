import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { EmptyAsUndefined } from 'src/common/decorators/empty-as-undefined.decorator';
import { Trim } from 'src/common/decorators/trim.decorator';
import { PaginationQueryDto } from 'src/shared/pagination/pagination-query.dto';

export const REWARD_STATUSES = ['active', 'inactive'] as const;

/** Query de `GET /rewards`. */
export class ListRewardsQuery extends PaginationQueryDto {
  /** Parte do nome. */
  @EmptyAsUndefined()
  @IsOptional()
  @Trim()
  @IsString({ message: 'A busca deve ser um texto.' })
  @MaxLength(120, { message: 'A busca deve ter no máximo 120 caracteres.' })
  search?: string;

  @EmptyAsUndefined()
  @IsOptional()
  @IsIn(REWARD_STATUSES, {
    message: 'A situação deve ser active ou inactive.',
  })
  status?: (typeof REWARD_STATUSES)[number];
}
