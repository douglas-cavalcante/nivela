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

/** O que fica gravado em `student_profiles` sobre a sequência. */
export interface StoredStreak {
  currentStreak: number;
  bestStreak: number;
  /** Coluna `date`: o driver a devolve como meia-noite UTC do dia gravado. */
  lastStudyDate: Date | null;
}

/** Número do dia (`dayNumber`) gravado numa coluna `date`. */
function storedDayNumber(lastStudyDate: Date): number {
  return dayNumber(lastStudyDate.toISOString().slice(0, 10));
}

/** Sequência de dias estudados (RN09), contada em dias de Fortaleza. */
@Injectable()
export class StreakService {
  constructor(private readonly coins: CoinLedger) {}

  /**
   * Ruling 10: sequência efetiva para toda leitura. A gravada só é atualizada
   * quando o aluno responde; se o último dia de estudo foi há mais de 1 dia
   * (em Fortaleza), a sequência já está quebrada (RN09: pular um dia zera) e
   * vale 0. O melhor nunca muda.
   */
  effective(
    profile: StoredStreak,
    now: Date,
  ): { current: number; best: number } {
    const broken =
      profile.lastStudyDate === null ||
      dayNumber(studyDay(now)) - storedDayNumber(profile.lastStudyDate) > 1;
    return {
      current: broken ? 0 : profile.currentStreak,
      best: profile.bestStreak,
    };
  }

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
    // se serializam e a segunda lê o estado já gravado pela primeira. O perfil
    // existe: quem chama já o travou (`lockStudentProfile`) antes.
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
    const profile: StoredStreak = {
      currentStreak: row.current_streak,
      bestStreak: row.best_streak,
      lastStudyDate: row.last_study_date,
    };
    const today = studyDay(now);
    const todayNumber = dayNumber(today);
    const lastNumber = profile.lastStudyDate
      ? storedDayNumber(profile.lastStudyDate)
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
