import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AnyAuthenticated } from 'src/common/decorators/any-authenticated.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from 'src/shared/enums/role.enum';

const FORBIDDEN = 'Você não tem permissão para acessar este recurso.';

class RotasDeTeste {
  @Roles(Role.Teacher, Role.Admin)
  restrita() {
    return true;
  }

  @AnyAuthenticated()
  qualquerLogado() {
    return true;
  }

  @Public()
  publica() {
    return true;
  }

  semMetadado() {
    return true;
  }
}

@Roles(Role.Admin)
class ControllerSoAdmin {
  acao() {
    return true;
  }
}

function criarContexto(
  metodo: keyof RotasDeTeste,
  user?: { role: Role },
): ExecutionContext {
  return {
    getHandler: () => RotasDeTeste.prototype[metodo],
    getClass: () => RotasDeTeste,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('libera quando o papel do usuário está em @Roles', () => {
    const contexto = criarContexto('restrita', { role: Role.Teacher });
    expect(guard.canActivate(contexto)).toBe(true);
  });

  it('nega com 403 quando o papel não está em @Roles', () => {
    const contexto = criarContexto('restrita', { role: Role.Student });
    expect(() => guard.canActivate(contexto)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contexto)).toThrow(FORBIDDEN);
  });

  it('nega com 403 quando não há usuário na requisição', () => {
    const contexto = criarContexto('restrita');
    expect(() => guard.canActivate(contexto)).toThrow(ForbiddenException);
  });

  it('libera @AnyAuthenticated para qualquer perfil', () => {
    for (const role of Object.values(Role)) {
      expect(guard.canActivate(criarContexto('qualquerLogado', { role }))).toBe(
        true,
      );
    }
  });

  it('libera rota @Public() mesmo sem usuário', () => {
    expect(guard.canActivate(criarContexto('publica'))).toBe(true);
  });

  it('nega por padrão (403) a rota sem @Roles, @AnyAuthenticated ou @Public', () => {
    const contexto = criarContexto('semMetadado', { role: Role.Admin });
    expect(() => guard.canActivate(contexto)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contexto)).toThrow(FORBIDDEN);
  });

  it('aplica o @Roles declarado no controller', () => {
    const contexto = (role: Role) =>
      ({
        getHandler: () => ControllerSoAdmin.prototype.acao,
        getClass: () => ControllerSoAdmin,
        switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
      }) as unknown as ExecutionContext;
    expect(guard.canActivate(contexto(Role.Admin))).toBe(true);
    expect(() => guard.canActivate(contexto(Role.Teacher))).toThrow(FORBIDDEN);
  });
});
