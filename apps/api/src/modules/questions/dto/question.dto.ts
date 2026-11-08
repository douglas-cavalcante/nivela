import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  Max,
  Min,
  IsString,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidateNested,
  ValidationOptions,
} from 'class-validator';
import { Trim } from 'src/common/decorators/trim.decorator';

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

/** Maior valor de uma coluna INTEGER do PostgreSQL. */
export const MAX_ID = 2_147_483_647;

export const OPTIONS_MESSAGE = 'Informe as 5 alternativas, de A a E.';

/** Alternativa enviada: validada item a item (`options.<i>.text`). */
export class QuestionOptionDto {
  @IsString({ message: 'Alternativa inválida.' })
  letter: (typeof OPTION_LETTERS)[number];

  @Trim()
  @IsString({ message: 'Informe o texto da alternativa.' })
  @MinLength(1, { message: 'Informe o texto da alternativa.' })
  @MaxLength(1000, {
    message: 'A alternativa deve ter no máximo 1000 caracteres.',
  })
  text: string;
}

/** Regra do conjunto: exatamente 5 alternativas, uma para cada letra de A a E. */
function IsCompleteOptionSet(options?: ValidationOptions) {
  return (target: object, propertyName: string): void =>
    registerDecorator({
      name: 'isCompleteOptionSet',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown): boolean {
          if (!Array.isArray(value) || value.length !== OPTION_LETTERS.length) {
            return false;
          }
          const letters = new Set(
            value.map((item: unknown) =>
              typeof item === 'object' && item !== null
                ? (item as { letter?: unknown }).letter
                : undefined,
            ),
          );
          return OPTION_LETTERS.every((letter) => letters.has(letter));
        },
      },
    });
}

/** Corpo de `POST /questions` e `PUT /questions/:id`. */
export class QuestionDto {
  @IsInt({ message: 'Escolha a disciplina.' })
  @Min(1, { message: 'Escolha a disciplina.' })
  @Max(MAX_ID, { message: 'Escolha a disciplina.' })
  subject_id: number;

  @IsInt({ message: 'Escolha a categoria.' })
  @Min(1, { message: 'Escolha a categoria.' })
  @Max(MAX_ID, { message: 'Escolha a categoria.' })
  category_id: number;

  @Trim()
  @IsString({ message: 'Informe o enunciado.' })
  @MinLength(10, { message: 'O enunciado deve ter pelo menos 10 caracteres.' })
  @MaxLength(5000, {
    message: 'O enunciado deve ter no máximo 5000 caracteres.',
  })
  statement: string;

  @IsIn(DIFFICULTIES, { message: 'Escolha a dificuldade.' })
  difficulty: (typeof DIFFICULTIES)[number];

  @Trim()
  @IsString({ message: 'Informe a explicação.' })
  @MinLength(1, { message: 'Informe a explicação.' })
  @MaxLength(5000, {
    message: 'A explicação deve ter no máximo 5000 caracteres.',
  })
  explanation: string;

  @IsCompleteOptionSet({ message: OPTIONS_MESSAGE })
  @ValidateNested({ each: true, message: OPTIONS_MESSAGE })
  @Type(() => QuestionOptionDto)
  options: QuestionOptionDto[];

  @IsIn(OPTION_LETTERS, { message: 'Escolha a alternativa correta.' })
  correct_letter: (typeof OPTION_LETTERS)[number];
}
