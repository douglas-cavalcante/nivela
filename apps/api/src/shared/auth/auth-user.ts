import { Role } from 'src/shared/enums/role.enum';

/** Usuário autenticado na requisição (o que `@CurrentUser()` devolve). */
export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

/** Token de injeção do resolvedor de tokens (implementado pelo módulo auth). */
export const TOKEN_RESOLVER = Symbol('TOKEN_RESOLVER');

/** Contrato usado pelo AuthGuard global, que vive em `common` e não importa features. */
export interface TokenResolver {
  /** Devolve o usuário ativo dono do token, ou null se inválido/revogado. */
  resolve(plain: string): Promise<AuthUser | null>;
}

/** Campos que o AuthGuard acrescenta à requisição. */
export interface AuthenticatedRequest {
  user?: AuthUser;
  accessToken?: string;
}
