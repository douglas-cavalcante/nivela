import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { MatchesField } from 'src/common/validators/matches-field.validator';

export class ChangePasswordDto {
  /** Senha em uso, para confirmar que é a própria pessoa. */
  @IsString({ message: 'Informe sua senha atual.' })
  @IsNotEmpty({ message: 'Informe sua senha atual.' })
  current_password: string;

  @IsString({ message: 'Informe a nova senha.' })
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  password: string;

  @IsString({ message: 'Confirme a nova senha.' })
  @MatchesField('password', { message: 'A confirmação de senha não confere.' })
  password_confirmation: string;
}
