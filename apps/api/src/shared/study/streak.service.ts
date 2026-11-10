import { Injectable } from '@nestjs/common';
import type { Prisma } from 'src/generated/prisma/client';
import { CoinLedger } from 'src/shared/coins/coin-ledger';
import { STREAK_BONUS, STREAK_BONUS_EVERY } from 'src/shared/coins/coin-rules';
import { dayNumber, studyDay } from 'src/shared/study/study-day';

export interface StreakResult {
  current: number;
  best: number;
  /** Moedas de bônus creditadas por esta chamada (0 se não houve marco). */
  bonus_awarded: number;
}

/** Sequência de dias estudados (RN09), contada em dias de Fortaleza. */
@Injectable()
export class StreakService {
  constructor(private readonly coins: CoinLedger) {}

  /**
   * Registra estudo no dia de `now`, na transação `tx`: mesmo dia não muda
   * nada; dia seguinte soma 1; qualquer outro caso recomeça em 1. Ao chegar a
   * um múltiplo de 7 credita o bônus, uma vez por dia de marco.
   */
  async register(
    tx: Prisma.TransactionClient,
    studentId: number,
    now: Date,
  ): Promise<StreakResult> {
    // Trava o perfil: duas transações do mesmo aluno (ex.: na virada do dia)
    // se serializam e a segunda lê o estado já gravado pela primeira.
    const [row] = await tx.$queryRaw<
      {
        current_streak: number;
        best_streak: number;
        last_study_date: Date | null;
      }[]
    >`
      SELECT "current_streak", "best_streak", "last_study_date"
      FROM "student_profiles"
      WHERE "user_id" = ${studentId} FOR UPDATE`;
    if (!row) {
      throw new Error(`Perfil de aluno ${studentId} não encontrado.`);
    }
    const profile = {
      currentStreak: row.current_streak,
      bestStreak: row.best_streak,
      lastStudyDate: row.last_study_date,
    };
    const today = studyDay(now);
    const todayNumber = dayNumber(today);
    // A coluna é `date`: o driver a devolve como meia-noite UTC do dia gravado.
    const lastNumber = profile.lastStudyDate
      ? dayNumber(profile.lastStudyDate.toISOString().slice(0, 10))
      : null;

    if (lastNumber !== null && todayNumber <= lastNumber) {
      return {
        current: profile.currentStreak,
        best: profile.bestStreak,
        bonus_awarded: 0,
      };
    }

    const current =
      lastNumber !== null && todayNumber - lastNumber === 1
        ? profile.currentStreak + 1
        : 1;
    const best = Math.max(profile.bestStreak, current);
    await tx.studentProfile.update({
      where: { userId: studentId },
      data: {
        currentStreak: current,
        bestStreak: best,
        lastStudyDate: new Date(`${today}T00:00:00Z`),
      },
    });

    let bonusAwarded = 0;
    if (current % STREAK_BONUS_EVERY === 0) {
      const { applied } = await this.coins.credit(tx, {
        studentId,
        amount: STREAK_BONUS,
        reason: 'streak_bonus',
        sourceType: 'study_day',
        sourceId: todayNumber,
      });
      bonusAwarded = applied ? STREAK_BONUS : 0;
    }
    return { current, best, bonus_awarded: bonusAwarded };
  }
}
