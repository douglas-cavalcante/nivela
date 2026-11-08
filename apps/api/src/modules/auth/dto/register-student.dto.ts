import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NormalizeEmail } from 'src/common/decorators/normalize-email.decorator';
import { MatchesField } from 'src/common/validators/matches-field.validator';
import { JoinCodeService } from 'src/modules/classrooms/join-code.service';

export class RegisterStudentDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'O nome é obrigatório.' })
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  @MaxLength(120, { message: 'O nome deve ter no máximo 120 caracteres.' })
  name: string;

  @NormalizeEmail()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(190, { message: 'O e-mail deve ter no máximo 190 caracteres.' })
  email: string;

  @IsString({ message: 'A senha é obrigatória.' })
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  password: string;

  @IsString({ message: 'A confirmação de senha é obrigatória.' })
  @MatchesField('password', { message: 'A confirmação de senha não confere.' })
  password_confirmation: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? JoinCodeService.normalize(value) : value,
  )
  @IsString({ message: 'O código da turma é obrigatório.' })
  @IsNotEmpty({ message: 'O código da turma é obrigatório.' })
  join_code: string;
}
