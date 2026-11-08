import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { resolveAuthorizationMetadata } from 'src/common/guards/authorization-metadata';
import { TOKEN_RESOLVER } from 'src/shared/auth/auth-user';
import type {
  AuthenticatedRequest,
  TokenResolver,
} from 'src/shared/auth/auth-user';

const NOT_AUTHENTICATED = 'Não autenticado.';

/**
 * Guard global: rotas `@Public()` passam; as demais exigem
 * `Authorization: Bearer <token>` válido de um usuário ativo.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_RESOLVER) private readonly tokens: TokenResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { isPublic } = resolveAuthorizationMetadata(
      this.reflector,
      context.getHandler(),
      context.getClass(),
    );
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & AuthenticatedRequest>();
    const plain = this.extractToken(request);
    const user = plain ? await this.tokens.resolve(plain) : null;
    if (!plain || !user) {
      throw new UnauthorizedException(NOT_AUTHENTICATED);
    }

    request.user = user;
    request.accessToken = plain;
    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }
    const [scheme, token, ...rest] = header.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
      return null;
    }
    return token;
  }
}
