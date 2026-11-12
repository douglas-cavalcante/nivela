import { Reflector } from '@nestjs/core';
import { ANY_AUTHENTICATED_KEY } from 'src/common/decorators/any-authenticated.decorator';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorator';
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/shared/enums/role.enum';

type Target = Parameters<Reflector['get']>[1];

export interface AuthorizationMetadata {
  isPublic: boolean | undefined;
  anyAuthenticated: boolean | undefined;
  roles: Role[] | undefined;
}

function read(reflector: Reflector, target: Target): AuthorizationMetadata {
  return {
    isPublic: reflector.get<boolean | undefined>(IS_PUBLIC_KEY, target),
    anyAuthenticated: reflector.get<boolean | undefined>(
      ANY_AUTHENTICATED_KEY,
      target,
    ),
    roles: reflector.get<Role[] | undefined>(ROLES_KEY, target),
  };
}

function declaresAny(metadata: AuthorizationMetadata): boolean {
  return (
    metadata.isPublic !== undefined ||
    metadata.anyAuthenticated !== undefined ||
    metadata.roles !== undefined
  );
}

/**
 * Metadata de autorização efetivo da rota: o do handler vence o da classe.
 * A classe só é consultada quando o handler não declara nenhuma das três
 * chaves (`@Public`, `@AnyAuthenticated`, `@Roles`) — assim `@Roles(Admin)` num
 * método não é anulado por um `@AnyAuthenticated`/`@Public` do controller.
 */
export function resolveAuthorizationMetadata(
  reflector: Reflector,
  handler: Target,
  controller: Target,
): AuthorizationMetadata {
  const fromHandler = read(reflector, handler);
  return declaresAny(fromHandler) ? fromHandler : read(reflector, controller);
}
