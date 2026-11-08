import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { AuthUser, TokenResolver } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

const USER: AuthUser = {
  id: 1,
  name: 'Ana',
  email: 'ana@escola.com',
  role: Role.Teacher,
};

describe('AuthGuard', () => {
  const resolve = jest.fn();
  const resolver: TokenResolver = { resolve };
  const reflector = { get: jest.fn() };
  const guard = new AuthGuard(reflector as unknown as Reflector, resolver);

  const contextFor = (request: Record<string, unknown>) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.resetAllMocks();
    reflector.get.mockReturnValue(false);
  });

  it('deixa passar rota pública sem consultar o token', async () => {
    reflector.get.mockReturnValue(true);

    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(
      true,
    );
    expect(resolve).not.toHaveBeenCalled();
  });

  it('autentica com Bearer válido e anexa user e accessToken', async () => {
    resolve.mockResolvedValue(USER);
    const request: Record<string, unknown> = {
      headers: { authorization: 'bearer abc123' },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(resolve).toHaveBeenCalledWith('abc123');
    expect(request.user).toEqual(USER);
    expect(request.accessToken).toBe('abc123');
  });

  it.each([
    ['sem cabeçalho', undefined],
    ['esquema diferente', 'Basic abc'],
    ['sem token', 'Bearer'],
    ['token com partes extras', 'Bearer a b'],
  ])('recusa %s', async (_label, authorization) => {
    await expect(
      guard.canActivate(contextFor({ headers: { authorization } })),
    ).rejects.toThrow(UnauthorizedException);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('recusa token que não resolve', async () => {
    resolve.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: 'Bearer inventado' } }),
      ),
    ).rejects.toThrow('Não autenticado.');
  });

  describe('metadata do handler x classe', () => {
    @Public()
    class ControllerPublico {
      @Public()
      aberta() {
        return true;
      }

      herdada() {
        return true;
      }

      @Roles(Role.Admin)
      restrita() {
        return true;
      }
    }

    const real = new AuthGuard(new Reflector(), { resolve });
    const contexto = (metodo: 'aberta' | 'herdada' | 'restrita') =>
      ({
        getHandler: () => ControllerPublico.prototype[metodo],
        getClass: () => ControllerPublico,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      }) as unknown as ExecutionContext;

    it('handler sem @Public numa classe @Public exige token', async () => {
      await expect(real.canActivate(contexto('restrita'))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('handler sem nenhum metadado herda o @Public da classe', async () => {
      await expect(real.canActivate(contexto('herdada'))).resolves.toBe(true);
    });

    it('handler @Public passa sem token', async () => {
      await expect(real.canActivate(contexto('aberta'))).resolves.toBe(true);
    });
  });
});
