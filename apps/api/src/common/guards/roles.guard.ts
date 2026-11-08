import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ANY_AUTHENTICATED_KEY } from 'src/common/decorators/any-authenticated.decorator';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorator';
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/shared/enums/role.enum';

interface RequestWithUser {
  user?: { role: Role };
}

/**
 * Autorização negada por padrão: a rota precisa ser `@Public()`,
 * `@AnyAuthenticated()` ou declarar `@Roles(...)` (no método ou no
 * controller). Qualquer outra recebe 403.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      targets,
    );
    const anyAuthenticated = this.reflector.getAllAndOverride<
      boolean | undefined
    >(ANY_AUTHENTICATED_KEY, targets);
    if (isPublic || anyAuthenticated) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      targets,
    );
    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    if (required?.length && user && required.includes(user.role)) {
      return true;
    }
    throw new ForbiddenException(
      'Você não tem permissão para acessar este recurso.',
    );
  }
}
