import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
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
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new AuthGuard(reflector as unknown as Reflector, resolver);

  const contextFor = (request: Record<string, unknown>) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.resetAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
  });

  it('deixa passar rota pública sem consultar o token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

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
});
