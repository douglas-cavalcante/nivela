import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from 'src/common/decorators/trim.decorator';
import {
  SUBJECT_COLOR_KEYS,
  SUBJECT_ICON_KEYS,
} from 'src/modules/subjects/subject-keys';

/** Corpo de `POST /subjects` e `PUT /subjects/:id`. */
export class SubjectDto {
  @Trim()
  @IsString({ message: 'Informe o nome da disciplina.' })
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres.' })
  @MaxLength(60, { message: 'O nome deve ter no máximo 60 caracteres.' })
  name: string;

  @IsIn(SUBJECT_COLOR_KEYS, { message: 'Escolha uma cor válida.' })
  color: (typeof SUBJECT_COLOR_KEYS)[number];

  @IsIn(SUBJECT_ICON_KEYS, { message: 'Escolha um ícone válido.' })
  icon: (typeof SUBJECT_ICON_KEYS)[number];
}
