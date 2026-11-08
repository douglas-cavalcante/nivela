import { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

/** Campos públicos do usuário (nunca devolve a senha). */
export function presentUser(user: {
  id: number;
  name: string;
  email: string;
  role: string;
}): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
  };
}
