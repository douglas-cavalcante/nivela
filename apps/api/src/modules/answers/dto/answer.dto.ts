import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Maior valor de uma coluna INTEGER do PostgreSQL. */
const MAX_ID = 2_147_483_647;
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Corpo de `POST /answers`. */
export class AnswerDto {
  @IsInt({ message: 'Escolha a questão.' })
  @Min(1, { message: 'Escolha a questão.' })
  @Max(MAX_ID, { message: 'Escolha a questão.' })
  question_id: number;

  @IsIn(OPTION_LETTERS, { message: 'Escolha uma alternativa.' })
  selected_letter: (typeof OPTION_LETTERS)[number];

  /** Ausente na prática livre; o capítulo é validado na Task 8. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Capítulo não encontrado.' })
  @Min(1, { message: 'Capítulo não encontrado.' })
  @Max(MAX_ID, { message: 'Capítulo não encontrado.' })
  plan_chapter_id?: number;
}
