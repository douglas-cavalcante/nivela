import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_PER_PAGE, MAX_PER_PAGE } from 'src/shared/pagination/paginate';
import { EmptyAsUndefined } from 'src/common/decorators/empty-as-undefined.decorator';

/** Query string das listagens paginadas: `?page=2&per_page=15`. */
export class PaginationQueryDto {
  @EmptyAsUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A página deve ser um número inteiro.' })
  @Min(1, { message: 'A página deve ser no mínimo 1.' })
  page?: number = 1;

  @EmptyAsUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A quantidade por página deve ser um número inteiro.' })
  @Min(1, { message: 'A quantidade por página deve ser no mínimo 1.' })
  @Max(MAX_PER_PAGE, {
    message: `A quantidade por página deve ser no máximo ${MAX_PER_PAGE}.`,
  })
  per_page?: number = DEFAULT_PER_PAGE;
}
