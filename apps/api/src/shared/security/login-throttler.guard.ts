import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Limita o login por ip + e-mail (normalizado), para que a turma inteira
 * entrando pelo mesmo Wi-Fi não bloqueie os colegas. Sem e-mail utilizável no
 * corpo, a chave é só o ip. O ip vem de `req.ip` (sem `trust proxy`: o
 * servidor do TCC não fica atrás de proxy).
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(
    req: Record<string, unknown>,
  ): Promise<string> {
    const ip = await super.getTracker(req);
    const body = req.body;
    const email =
      typeof body === 'object' && body !== null
        ? (body as { email?: unknown }).email
        : undefined;
    const normalized =
      typeof email === 'string' ? email.trim().toLowerCase() : '';
    return normalized ? `${ip}:${normalized}` : ip;
  }
}
