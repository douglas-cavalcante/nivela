import { Logger } from '@nestjs/common';
import { TokenService } from 'src/modules/auth/token.service';
import type { TokenChannel } from 'src/modules/auth/token.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Clock } from 'src/shared/clock/clock';

const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;
const CREATED = new Date('2026-01-01T12:00:00.000Z');
const user = {
  id: 7,
  name: 'Ana',
  email: 'ana@nivela.test',
  role: 'teacher',
  active: true,
};

interface StoredToken {
  channel: TokenChannel;
  createdAt?: Date;
  lastUsedAt?: Date | null;
  active?: boolean;
}

function setup(stored: StoredToken | null, nowMs: number) {
  const prisma = {
    accessToken: {
      findUnique: jest.fn().mockResolvedValue(
        stored && {
          id: 1,
          channel: stored.channel,
          createdAt: stored.createdAt ?? CREATED,
          lastUsedAt: stored.lastUsedAt ?? null,
          user: { ...user, active: stored.active ?? true },
        },
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const clock: Clock = { now: () => new Date(nowMs) };
  const service = new TokenService(prisma as unknown as PrismaService, clock);
  return { service, prisma };
}

const at = (ms: number) => CREATED.getTime() + ms;
const expectedUser = {
  id: 7,
  name: 'Ana',
  email: 'ana@nivela.test',
  role: 'teacher',
};

describe('TokenService.resolve — expiração', () => {
  describe.each([
    ['web', 7, 30],
    ['mobile', 30, 180],
  ] as const)(
    'canal %s (ociosidade %i dias, absoluto %i dias)',
    (channel, idleDays, absoluteDays) => {
      it('sem uso: vale até 1 ms antes do limite de ociosidade (conta a partir da criação)', async () => {
        const { service, prisma } = setup({ channel }, at(idleDays * DAY - 1));
        await expect(service.resolve('t')).resolves.toEqual(expectedUser);
        expect(prisma.accessToken.deleteMany).not.toHaveBeenCalled();
      });

      it('sem uso: expira ao atingir o limite de ociosidade e apaga o token', async () => {
        const { service, prisma } = setup({ channel }, at(idleDays * DAY));
        await expect(service.resolve('t')).resolves.toBeNull();
        expect(prisma.accessToken.deleteMany).toHaveBeenCalledWith({
          where: { id: 1 },
        });
      });

      it('ociosidade conta a partir do último uso', async () => {
        const lastUsedAt = new Date(at(10 * DAY));
        const valid = setup(
          { channel, lastUsedAt },
          at(10 * DAY + idleDays * DAY - 1),
        );
        await expect(valid.service.resolve('t')).resolves.toEqual(expectedUser);

        const expired = setup(
          { channel, lastUsedAt },
          at(10 * DAY + idleDays * DAY),
        );
        await expect(expired.service.resolve('t')).resolves.toBeNull();
        expect(expired.prisma.accessToken.deleteMany).toHaveBeenCalled();
      });

      it('limite absoluto conta a partir da criação, mesmo com uso recente', async () => {
        const now = at(absoluteDays * DAY);
        const lastUsedAt = new Date(now - DAY);

        const valid = setup({ channel, lastUsedAt }, now - 1);
        await expect(valid.service.resolve('t')).resolves.toEqual(expectedUser);

        const expired = setup({ channel, lastUsedAt }, now);
        await expect(expired.service.resolve('t')).resolves.toBeNull();
        expect(expired.prisma.accessToken.deleteMany).toHaveBeenCalledWith({
          where: { id: 1 },
        });
      });
    },
  );

  it('token inexistente → null', async () => {
    const { service } = setup(null, at(0));
    await expect(service.resolve('t')).resolves.toBeNull();
  });

  it('usuário inativo → null, sem atualizar o último uso', async () => {
    const { service, prisma } = setup({ channel: 'web', active: false }, at(0));
    await expect(service.resolve('t')).resolves.toBeNull();
    expect(prisma.accessToken.updateMany).not.toHaveBeenCalled();
  });
});

describe('TokenService.resolve — último uso', () => {
  it('grava o último uso quando ainda não há nenhum', async () => {
    const { service, prisma } = setup({ channel: 'web' }, at(SECOND));
    await service.resolve('t');
    expect(prisma.accessToken.updateMany).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { lastUsedAt: new Date(at(SECOND)) },
    });
  });

  it('não grava de novo com 60 s ou menos desde o último uso', async () => {
    const lastUsedAt = new Date(at(DAY));
    const { service, prisma } = setup(
      { channel: 'web', lastUsedAt },
      at(DAY + 60 * SECOND),
    );
    await service.resolve('t');
    expect(prisma.accessToken.updateMany).not.toHaveBeenCalled();
  });

  it('grava quando o último uso tem mais de 60 s', async () => {
    const lastUsedAt = new Date(at(DAY));
    const { service, prisma } = setup(
      { channel: 'web', lastUsedAt },
      at(DAY + 60 * SECOND + 1),
    );
    await service.resolve('t');
    expect(prisma.accessToken.updateMany).toHaveBeenCalled();
  });

  it('falha ao gravar o último uso não derruba a requisição (registra no log)', async () => {
    const { service, prisma } = setup({ channel: 'web' }, at(SECOND));
    prisma.accessToken.updateMany.mockRejectedValue(new Error('banco ocupado'));
    const logger = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await expect(service.resolve('t')).resolves.toEqual(expectedUser);
    expect(logger).toHaveBeenCalled();
    logger.mockRestore();
  });
});
