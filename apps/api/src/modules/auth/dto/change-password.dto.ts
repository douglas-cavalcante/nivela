import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { MatchesField } from 'src/common/validators/matches-field.validator';

export class ChangePasswordDto {
  /** Senha em uso, para confirmar que é a própria pessoa. */
  @IsString({ message: 'A senha atual é obrigatória.' })
  @IsNotEmpty({ message: 'A senha atual é obrigatória.' })
  current_password: string;

  @IsString({ message: 'A nova senha é obrigatória.' })
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  password: string;

  @IsString({ message: 'A confirmação de senha é obrigatória.' })
  @MatchesField('password', { message: 'A confirmação de senha não confere.' })
  password_confirmation: string;
}
