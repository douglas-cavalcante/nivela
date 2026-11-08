import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { resolveAuthorizationMetadata } from 'src/common/guards/authorization-metadata';
import { Role } from 'src/shared/enums/role.enum';

interface RequestWithUser {
  user?: { role: Role };
}

/**
 * Autorização negada por padrão: a rota precisa ser `@Public()`,
 * `@AnyAuthenticated()` ou declarar `@Roles(...)` (no método ou no
 * controller; o do método prevalece). Qualquer outra recebe 403.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { isPublic, anyAuthenticated, roles } = resolveAuthorizationMetadata(
      this.reflector,
      context.getHandler(),
      context.getClass(),
    );
    if (isPublic || anyAuthenticated) {
      return true;
    }

    const required = roles;
    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    if (required?.length && user && required.includes(user.role)) {
      return true;
    }
    throw new ForbiddenException(
      'Você não tem permissão para acessar este recurso.',
    );
  }
}
