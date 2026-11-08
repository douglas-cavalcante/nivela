import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail } from 'src/common/decorators/normalize-email.decorator';
import { Trim } from 'src/common/decorators/trim.decorator';

/** Corpo de `PUT /teachers/:id`. */
export class UpdateTeacherDto {
  @Trim()
  @IsString({ message: 'Informe o nome do professor.' })
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres.' })
  @MaxLength(120, { message: 'O nome deve ter no máximo 120 caracteres.' })
  name: string;

  @NormalizeEmail()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(190, { message: 'O e-mail deve ter no máximo 190 caracteres.' })
  email: string;
}
