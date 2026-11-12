import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from 'src/common/decorators/trim.decorator';

/** Campos comuns de turma. */
export class ClassroomDto {
  @Trim()
  @IsString({ message: 'Informe o nome da turma.' })
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres.' })
  @MaxLength(120, { message: 'O nome deve ter no máximo 120 caracteres.' })
  name: string;

  /** Texto livre (ex.: "9º ano"); vazio ou null limpa o campo. */
  @IsOptional()
  @Trim({ emptyAsNull: true })
  @IsString({ message: 'O ano letivo deve ser um texto.' })
  @MaxLength(40, { message: 'O ano letivo deve ter no máximo 40 caracteres.' })
  school_year?: string | null;
}
