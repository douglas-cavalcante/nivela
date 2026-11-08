import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthUser, TokenResolver } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

export type TokenChannel = 'web' | 'mobile';

@Injectable()
export class TokenService implements TokenResolver {
  constructor(private readonly prisma: PrismaService) {}

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

  async resolve(plain: string): Promise<AuthUser | null> {
    const token = await this.prisma.accessToken.findUnique({
      where: { tokenHash: TokenService.hash(plain) },
      include: { user: true },
    });
    if (!token || !token.user.active) {
      return null;
    }

    // updateMany: se o token for revogado entre a leitura e aqui, não explode.
    await this.prisma.accessToken.updateMany({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    });
    const { id, name, email, role } = token.user;
    return { id, name, email, role: role as Role };
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
