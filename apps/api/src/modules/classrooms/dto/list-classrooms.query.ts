import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from 'src/common/decorators/trim.decorator';
import { PaginationQueryDto } from 'src/shared/pagination/pagination-query.dto';
import { EmptyAsUndefined } from 'src/common/decorators/empty-as-undefined.decorator';

export const CLASSROOM_STATUSES = ['active', 'inactive'] as const;

/** Query de `GET /classrooms`. */
export class ListClassroomsQuery extends PaginationQueryDto {
  /** Parte do nome da turma. */
  @EmptyAsUndefined()
  @IsOptional()
  @Trim()
  @IsString({ message: 'A busca deve ser um texto.' })
  @MaxLength(120, { message: 'A busca deve ter no máximo 120 caracteres.' })
  search?: string;

  @EmptyAsUndefined()
  @IsOptional()
  @IsIn(CLASSROOM_STATUSES, {
    message: 'A situação deve ser active ou inactive.',
  })
  status?: (typeof CLASSROOM_STATUSES)[number];
}
