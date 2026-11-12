import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import type { CoinReason } from 'src/generated/prisma/client';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';

/** Motivos de crédito. */
export type CreditReason = Exclude<CoinReason, 'redemption'>;
/** Único motivo de débito. */
export type DebitReason = Extract<CoinReason, 'redemption'>;

interface Movement<R extends CoinReason> {
  studentId: number;
  /** Sempre positivo; o sentido (crédito ou débito) vem do método chamado. */
  amount: number;
  reason: R;
  sourceType: string;
  sourceId: number;
}

export type CreditMovement = Movement<CreditReason>;
export type DebitMovement = Movement<DebitReason>;

export interface CreditResult {
  /** Falso quando o crédito "uma vez" já existia: nada foi alterado. */
  applied: boolean;
  /** Saldo do aluno depois da operação. */
  balance: number;
}

/**
 * Motivos que só podem render crédito uma vez por (aluno, origem): cada um tem
 * um índice único parcial no banco (`coin_once_per_*`). O predicado do ON
 * CONFLICT precisa ser idêntico ao do índice.
 */
const ONCE_PER_SOURCE: ReadonlySet<CoinReason> = new Set([
  'correct_answer',
  'plan_completed',
  'streak_bonus',
  'refund',
]);

function assertPositiveInteger(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new RangeError('O valor da moeda deve ser um inteiro positivo.');
  }
}

/**
 * Trava a linha do perfil até o fim da transação (primeiro lock de toda
 * operação de moedas). Sem perfil (conta que não é de aluno), responde 404
 * logo aqui, antes de qualquer gravação, em vez de um P2025/500 tardio.
 */
export async function lockStudentProfile(
  tx: Prisma.TransactionClient,
  studentId: number,
): Promise<void> {
  const rows = await tx.$queryRaw<{ user_id: number }[]>`
    SELECT "user_id" FROM "student_profiles"
    WHERE "user_id" = ${studentId} FOR UPDATE`;
  if (rows.length === 0) {
    throw new NotFoundException('Aluno não encontrado.');
  }
}

/**
 * Único caminho para mexer em moedas: grava a linha do extrato
 * (`coin_transactions`) e ajusta `coins_balance` na mesma transação do
 * chamador (`tx`). Os créditos "uma vez" usam `INSERT ... ON CONFLICT DO
 * NOTHING`: uma violação de unicidade abortaria a transação do chamador, então
 * ela nunca é provocada; o saldo só sobe se a linha realmente entrou.
 *
 * Regra de travas: o perfil do aluno é sempre o primeiro lock da transação;
 * prêmio e resgate vêm depois. Quem chama trava o perfil
 * (`lockStudentProfile`) antes de qualquer outra linha (plano, questão,
 * prêmio, resgate); `credit` e `debit` travam o perfil de novo (reentrante na
 * mesma transação) e só então tocam no extrato. Seguida essa regra, crédito,
 * débito e `StreakService.register` podem vir em qualquer ordem na mesma
 * transação sem risco de deadlock. Ordem completa: `docs/architecture.md`
 * ("Ordem de travas").
 */
@Injectable()
export class CoinLedger {
  async credit(
    tx: Prisma.TransactionClient,
    movement: CreditMovement,
  ): Promise<CreditResult> {
    assertPositiveInteger(movement.amount);
    const { studentId, amount, reason, sourceType, sourceId } = movement;
    await lockStudentProfile(tx, studentId);

    if (!ONCE_PER_SOURCE.has(reason)) {
      await tx.coinTransaction.create({
        data: { studentId, amount, reason, sourceType, sourceId },
      });
    } else {
      const inserted = await tx.$executeRaw`
        INSERT INTO "coin_transactions"
          ("student_id", "amount", "reason", "source_type", "source_id")
        VALUES
          (${studentId}, ${amount}, ${reason}::"coin_reason", ${sourceType}, ${sourceId})
        ON CONFLICT ("student_id", "source_id")
          WHERE "reason" = ${Prisma.raw(`'${reason}'`)}
        DO NOTHING`;
      if (inserted === 0) {
        const profile = await tx.studentProfile.findUniqueOrThrow({
          where: { userId: studentId },
          select: { coinsBalance: true },
        });
        return { applied: false, balance: profile.coinsBalance };
      }
    }

    const profile = await tx.studentProfile.update({
      where: { userId: studentId },
      data: { coinsBalance: { increment: amount } },
      select: { coinsBalance: true },
    });
    return { applied: true, balance: profile.coinsBalance };
  }

  /**
   * Gasta moedas (resgate). O saldo é descontado com `WHERE coins_balance >=
   * amount`: sem saldo, nada é gravado e a regra de negócio responde 409.
   */
  async debit(
    tx: Prisma.TransactionClient,
    movement: DebitMovement,
  ): Promise<{ balance: number }> {
    assertPositiveInteger(movement.amount);
    const { studentId, amount, reason, sourceType, sourceId } = movement;
    await lockStudentProfile(tx, studentId);

    const rows = await tx.$queryRaw<{ coins_balance: number }[]>`
      UPDATE "student_profiles"
      SET "coins_balance" = "coins_balance" - ${amount}
      WHERE "user_id" = ${studentId} AND "coins_balance" >= ${amount}
      RETURNING "coins_balance"`;
    if (rows.length === 0) {
      throw new BusinessRuleException('Saldo insuficiente.');
    }
    await tx.coinTransaction.create({
      data: { studentId, amount: -amount, reason, sourceType, sourceId },
    });
    return { balance: rows[0].coins_balance };
  }
}
