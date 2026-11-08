import { IsString, MaxLength, MinLength } from 'class-validator';
import { UpdateTeacherDto } from 'src/modules/teachers/dto/update-teacher.dto';

/** Corpo de `POST /teachers`. */
export class CreateTeacherDto extends UpdateTeacherDto {
  @IsString({ message: 'Informe a senha.' })
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  password: string;
}
