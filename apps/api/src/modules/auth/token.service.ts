import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthUser, TokenResolver } from 'src/shared/auth/auth-user';
import { CLOCK } from 'src/shared/clock/clock';
import type { Clock } from 'src/shared/clock/clock';
import { Role } from 'src/shared/enums/role.enum';

export type TokenChannel = 'web' | 'mobile';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Validade dos tokens por canal: `idle` conta desde o último uso (ou da
 * criação, se nunca foi usado) e `absolute` desde a criação.
 */
export const TOKEN_LIFETIME: Record<
  TokenChannel,
  { idleMs: number; absoluteMs: number }
> = {
  web: { idleMs: 7 * DAY_MS, absoluteMs: 30 * DAY_MS },
  mobile: { idleMs: 30 * DAY_MS, absoluteMs: 180 * DAY_MS },
};

/** O último uso só é regravado depois deste intervalo, para não escrever a cada requisição. */
const LAST_USED_REFRESH_MS = 60 * 1000;

@Injectable()
export class TokenService implements TokenResolver {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  static hash(plain: string): string {
    return createHash('sha256').update(plain).digest('hex');
  }

  /**
   * Gera um token aleatório (32 bytes em hex), grava só o SHA-256 e devolve o
   * texto puro, que não pode ser recuperado depois. `client` permite emitir
   * dentro de uma transação.
   */
  async issue(
    userId: number,
    channel: TokenChannel,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    const plain = randomBytes(32).toString('hex');
    await client.accessToken.create({
      data: { userId, channel, tokenHash: TokenService.hash(plain) },
    });
    return plain;
  }

  /**
   * Devolve o usuário ativo dono do token. Token expirado (ociosidade ou
   * limite absoluto do canal) é apagado e vale como inexistente (401).
   */
  async resolve(plain: string): Promise<AuthUser | null> {
    const token = await this.prisma.accessToken.findUnique({
      where: { tokenHash: TokenService.hash(plain) },
      include: { user: true },
    });
    if (!token) {
      return null;
    }

    const now = this.clock.now();
    if (this.isExpired(token, now)) {
      await this.prisma.accessToken.deleteMany({ where: { id: token.id } });
      return null;
    }
    if (!token.user.active) {
      return null;
    }

    if (
      !token.lastUsedAt ||
      now.getTime() - token.lastUsedAt.getTime() > LAST_USED_REFRESH_MS
    ) {
      await this.touch(token.id, now);
    }
    const { id, name, email, role } = token.user;
    return { id, name, email, role: role as Role };
  }

  private isExpired(
    token: { channel: TokenChannel; createdAt: Date; lastUsedAt: Date | null },
    now: Date,
  ): boolean {
    const { idleMs, absoluteMs } = TOKEN_LIFETIME[token.channel];
    const lastActivity = token.lastUsedAt ?? token.createdAt;
    return (
      now.getTime() - lastActivity.getTime() >= idleMs ||
      now.getTime() - token.createdAt.getTime() >= absoluteMs
    );
  }

  /** Grava o último uso; uma falha aqui não deve derrubar a requisição. */
  private async touch(tokenId: number, now: Date): Promise<void> {
    try {
      // updateMany: se o token for revogado entre a leitura e aqui, não explode.
      await this.prisma.accessToken.updateMany({
        where: { id: tokenId },
        data: { lastUsedAt: now },
      });
    } catch (error) {
      this.logger.warn(
        `Não foi possível gravar o último uso do token ${tokenId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Apaga todos os tokens do usuário, exceto o informado (a sessão atual). */
  async revokeOthers(
    userId: number,
    keepPlain?: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.accessToken.deleteMany({
      where: {
        userId,
        ...(keepPlain
          ? { tokenHash: { not: TokenService.hash(keepPlain) } }
          : {}),
      },
    });
  }

  async revoke(plain: string): Promise<void> {
    await this.prisma.accessToken.deleteMany({
      where: { tokenHash: TokenService.hash(plain) },
    });
  }
}
