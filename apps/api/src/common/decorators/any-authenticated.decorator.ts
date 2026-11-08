import { SetMetadata } from '@nestjs/common';

export const ANY_AUTHENTICATED_KEY = 'anyAuthenticated';

/**
 * Libera a rota para qualquer usuário autenticado, de qualquer perfil.
 * Sem este decorator, sem `@Roles(...)` e sem `@Public()`, o `RolesGuard`
 * nega o acesso (403): a autorização é negada por padrão.
 */
export const AnyAuthenticated = () => SetMetadata(ANY_AUTHENTICATED_KEY, true);
