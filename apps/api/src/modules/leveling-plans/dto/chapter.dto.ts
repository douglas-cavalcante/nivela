import { IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from 'src/common/decorators/trim.decorator';

/** Corpo de `POST /plans/:id/chapters` e `PUT /plans/:id/chapters/:chapterId`. */
export class ChapterDto {
  @Trim()
  @IsString({ message: 'Informe o título do capítulo.' })
  @MinLength(2, { message: 'O título deve ter pelo menos 2 caracteres.' })
  @MaxLength(120, { message: 'O título deve ter no máximo 120 caracteres.' })
  title: string;
}
