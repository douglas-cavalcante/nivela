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

const MAX_ID = 2_147_483_647;
const SUBJECT_MESSAGE = 'Escolha a disciplina.';
const BONUS_MESSAGE = 'O bônus deve ser um número inteiro de 0 a 500.';

/** Corpo de `POST /plans` e `PUT /plans/:id`. */
export class PlanDto {
  @Trim()
  @IsString({ message: 'Informe o título do plano.' })
  @MinLength(3, { message: 'O título deve ter pelo menos 3 caracteres.' })
  @MaxLength(120, { message: 'O título deve ter no máximo 120 caracteres.' })
  title: string;

  /** Texto livre; vazio ou null limpa o campo. */
  @IsOptional()
  @Trim({ emptyAsNull: true })
  @IsString({ message: 'A descrição deve ser um texto.' })
  @MaxLength(1000, {
    message: 'A descrição deve ter no máximo 1000 caracteres.',
  })
  description?: string | null;

  @IsInt({ message: SUBJECT_MESSAGE })
  @Min(1, { message: SUBJECT_MESSAGE })
  @Max(MAX_ID, { message: SUBJECT_MESSAGE })
  subject_id: number;

  /** Moedas ao concluir o plano; ausente = 50 na criação e "não mexe" na edição. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: BONUS_MESSAGE })
  @Min(0, { message: BONUS_MESSAGE })
  @Max(500, { message: BONUS_MESSAGE })
  completion_bonus?: number;
}
