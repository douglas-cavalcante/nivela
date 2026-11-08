import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail } from 'src/common/decorators/normalize-email.decorator';
import { Trim } from 'src/common/decorators/trim.decorator';

/** Corpo de `POST /classrooms/:id/students` (matrícula manual pelo professor). */
export class CreateClassroomStudentDto {
  @Trim()
  @IsString({ message: 'Informe o nome do aluno.' })
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres.' })
  @MaxLength(120, { message: 'O nome deve ter no máximo 120 caracteres.' })
  name: string;

  @NormalizeEmail()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(190, { message: 'O e-mail deve ter no máximo 190 caracteres.' })
  email: string;

  @IsString({ message: 'Informe a senha.' })
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  password: string;
}
