import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PREFIX = 'NIV-';
const SUFFIX_LENGTH = 4;
const MAX_ATTEMPTS = 10;

@Injectable()
export class JoinCodeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Código digitado pelo usuário → forma canônica `NIV-XXXX`: tira todos os
   * espaços, passa para maiúsculas e põe o hífen depois de `NIV` se faltar
   * (" niv 4k7q " e "niv4k7q" viram "NIV-4K7Q").
   */
  static normalize(raw: string): string {
    const compact = raw.replace(/\s+/g, '').toUpperCase();
    return /^NIV[^-]/.test(compact) ? `NIV-${compact.slice(3)}` : compact;
  }

  /** Gera um código `NIV-XXXX` ainda não usado por nenhuma turma. */
  async generate(): Promise<string> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const code = PREFIX + this.randomSuffix();
      const taken = await this.prisma.classroom.findUnique({
        where: { joinCode: code },
        select: { id: true },
      });
      if (!taken) {
        return code;
      }
    }
    throw new Error('Não foi possível gerar um código de turma único.');
  }

  private randomSuffix(): string {
    let suffix = '';
    for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
      suffix += ALPHABET[randomInt(ALPHABET.length)];
    }
    return suffix;
  }
}
