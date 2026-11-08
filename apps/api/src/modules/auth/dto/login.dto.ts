import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { NormalizeEmail } from 'src/common/decorators/normalize-email.decorator';

export class LoginDto {
  @NormalizeEmail()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @IsString({ message: 'A senha é obrigatória.' })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  password: string;

  /** Onde a pessoa está entrando: `web` (professor/admin) ou `mobile` (aluno). */
  @IsIn(['web', 'mobile'], { message: 'O canal deve ser web ou mobile.' })
  channel: 'web' | 'mobile';
}
