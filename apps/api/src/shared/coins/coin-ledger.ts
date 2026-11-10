import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import type { CoinReason } from 'src/generated/prisma/client';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';

export interface CoinMovement {
  studentId: number;
  /** Sempre positivo; o sentido (crédito ou débito) vem do método chamado. */
  amount: number;
  reason: CoinReason;
  sourceType: string;
  sourceId: number;
}

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
]);

function assertPositiveInteger(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new RangeError('O valor da moeda deve ser um inteiro positivo.');
  }
}

/**
 * Único caminho para mexer em moedas: grava a linha do extrato
 * (`coin_transactions`) e ajusta `coins_balance` na mesma transação do
 * chamador (`tx`). Os créditos "uma vez" usam `INSERT ... ON CONFLICT DO
 * NOTHING`: uma violação de unicidade abortaria a transação do chamador, então
 * ela nunca é provocada; o saldo só sobe se a linha realmente entrou.
 */
@Injectable()
export class CoinLedger {
  async credit(
    tx: Prisma.TransactionClient,
    movement: CoinMovement,
  ): Promise<CreditResult> {
    assertPositiveInteger(movement.amount);
    const { studentId, amount, reason, sourceType, sourceId } = movement;

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
    movement: CoinMovement,
  ): Promise<{ balance: number }> {
    assertPositiveInteger(movement.amount);
    const { studentId, amount, reason, sourceType, sourceId } = movement;

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
