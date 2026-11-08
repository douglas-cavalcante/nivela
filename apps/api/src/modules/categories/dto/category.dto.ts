import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Trim } from 'src/common/decorators/trim.decorator';
import { EmptyAsUndefined } from 'src/common/decorators/empty-as-undefined.decorator';

const MAX_ID = 2_147_483_647;

/** Corpo de `PUT /categories/:id`: só o nome muda (a disciplina é fixa). */
export class UpdateCategoryDto {
  @Trim()
  @IsString({ message: 'Informe o nome da categoria.' })
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres.' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres.' })
  name: string;
}

/** Corpo de `POST /categories`. */
export class CreateCategoryDto extends UpdateCategoryDto {
  @Type(() => Number)
  @IsInt({ message: 'Escolha uma disciplina válida.' })
  @Min(1, { message: 'Escolha uma disciplina válida.' })
  @Max(MAX_ID, { message: 'Escolha uma disciplina válida.' })
  subject_id: number;
}

/** Query de `GET /categories`: `?subject_id=3` (opcional). */
export class ListCategoriesQueryDto {
  @EmptyAsUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'A disciplina deve ser um número inteiro.' })
  @Min(1, { message: 'A disciplina deve ser um número inteiro.' })
  @Max(MAX_ID, { message: 'A disciplina deve ser um número inteiro.' })
  subject_id?: number;
}
