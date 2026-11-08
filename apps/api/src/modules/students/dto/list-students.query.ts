import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from 'src/common/decorators/trim.decorator';
import { PaginationQueryDto } from 'src/shared/pagination/pagination-query.dto';

const MAX_ID = 2_147_483_647;
const CLASSROOM_MESSAGE = 'A turma deve ser um número inteiro.';

/** Query de `GET /students`. */
export class ListStudentsQuery extends PaginationQueryDto {
  /** Parte do nome ou do e-mail. */
  @IsOptional()
  @Trim()
  @IsString({ message: 'A busca deve ser um texto.' })
  @MaxLength(120, { message: 'A busca deve ter no máximo 120 caracteres.' })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: CLASSROOM_MESSAGE })
  @Min(1, { message: CLASSROOM_MESSAGE })
  @Max(MAX_ID, { message: CLASSROOM_MESSAGE })
  classroom_id?: number;
}
