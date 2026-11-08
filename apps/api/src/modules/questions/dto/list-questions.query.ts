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
import { Trim } from 'src/common/decorators/trim.decorator';
import { DIFFICULTIES, MAX_ID } from 'src/modules/questions/dto/question.dto';
import { PaginationQueryDto } from 'src/shared/pagination/pagination-query.dto';

export const QUESTION_STATUSES = ['active', 'inactive'] as const;

/** Query de `GET /questions`. */
export class ListQuestionsQuery extends PaginationQueryDto {
  /** Parte do enunciado. */
  @IsOptional()
  @Trim()
  @IsString({ message: 'A busca deve ser um texto.' })
  @MaxLength(120, { message: 'A busca deve ter no máximo 120 caracteres.' })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A disciplina deve ser um número inteiro.' })
  @Min(1, { message: 'A disciplina deve ser um número inteiro.' })
  @Max(MAX_ID, { message: 'A disciplina deve ser um número inteiro.' })
  subject_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A categoria deve ser um número inteiro.' })
  @Min(1, { message: 'A categoria deve ser um número inteiro.' })
  @Max(MAX_ID, { message: 'A categoria deve ser um número inteiro.' })
  category_id?: number;

  @IsOptional()
  @IsIn(DIFFICULTIES, {
    message: 'A dificuldade deve ser easy, medium ou hard.',
  })
  difficulty?: (typeof DIFFICULTIES)[number];

  @IsOptional()
  @IsIn(QUESTION_STATUSES, {
    message: 'A situação deve ser active ou inactive.',
  })
  status?: (typeof QUESTION_STATUSES)[number];
}
