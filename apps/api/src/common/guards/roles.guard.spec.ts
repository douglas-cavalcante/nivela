import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from 'src/shared/enums/role.enum';

class RotaProtegida {
  @Roles(Role.Teacher, Role.Admin)
  restrita() {
    return true;
  }

  aberta() {
    return true;
  }
}

function criarContexto(
  metodo: keyof RotaProtegida,
  user?: { role: Role },
): ExecutionContext {
  return {
    getHandler: () => RotaProtegida.prototype[metodo],
    getClass: () => RotaProtegida,
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
    expect(() => guard.canActivate(contexto)).toThrow(
      'Você não tem permissão para acessar este recurso.',
    );
  });

  it('nega com 403 quando não há usuário na requisição', () => {
    const contexto = criarContexto('restrita');
    expect(() => guard.canActivate(contexto)).toThrow(ForbiddenException);
  });

  it('libera rota sem @Roles', () => {
    const contexto = criarContexto('aberta', { role: Role.Student });
    expect(guard.canActivate(contexto)).toBe(true);
  });
});
