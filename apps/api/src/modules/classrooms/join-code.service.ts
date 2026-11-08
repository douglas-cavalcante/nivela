import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { isUniqueViolation } from 'src/shared/prisma/unique-violation';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PREFIX = 'NIV-';
const SUFFIX_LENGTH = 4;
const MAX_ATTEMPTS = 10;
// Restrição única do código em `classrooms` (nome gerado pela migration).
const JOIN_CODE_UNIQUE_CONSTRAINT = 'classrooms_join_code_key';

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

  /** Sorteia um código `NIV-XXXX` (sem garantir que esteja livre). */
  static randomCode(): string {
    let suffix = '';
    for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
      suffix += ALPHABET[randomInt(ALPHABET.length)];
    }
    return PREFIX + suffix;
  }

  /**
   * Cria a turma com um código sorteado. A unicidade é decidida pelo banco:
   * se outro código igual já existir (P2002 em `classrooms_join_code_key`),
   * sorteia outro, até 10 tentativas. Não use dentro de transação: um erro de
   * unicidade aborta a transação do PostgreSQL e impediria a nova tentativa.
   */
  createWithUniqueCode(
    data: Omit<Prisma.ClassroomUncheckedCreateInput, 'joinCode'>,
  ) {
    return this.withUniqueCode((joinCode) =>
      this.prisma.classroom.create({ data: { ...data, joinCode } }),
    );
  }

  /** Troca o código da turma por um novo e devolve-o (mesmo retry contra colisão). */
  async regenerate(classroomId: number): Promise<string> {
    const classroom = await this.withUniqueCode((joinCode) =>
      this.prisma.classroom.update({
        where: { id: classroomId },
        data: { joinCode },
        select: { joinCode: true },
      }),
    );
    return classroom.joinCode;
  }

  private async withUniqueCode<T>(
    write: (joinCode: string) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        return await write(JoinCodeService.randomCode());
      } catch (error) {
        if (!isUniqueViolation(error, JOIN_CODE_UNIQUE_CONSTRAINT)) {
          throw error;
        }
      }
    }
    throw new Error('Não foi possível gerar um código de turma único.');
  }
}
