import { IsBoolean } from 'class-validator';

/** Corpo de `PATCH /questions/:id/status`. */
export class QuestionStatusDto {
  @IsBoolean({ message: 'Informe se a questão está ativa.' })
  active: boolean;
}
