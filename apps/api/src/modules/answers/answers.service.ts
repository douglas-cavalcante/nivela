import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ApiAnswerResult, ApiStudentStats } from '@nivela/api-contract';
import type { Prisma } from 'src/generated/prisma/client';
import { AnswerDto } from 'src/modules/answers/dto/answer.dto';
import {
  presentAnswerResult,
  type AnswerOutcome,
} from 'src/modules/answers/presenters/answer-result.presenter';
import { StudentPlansService } from 'src/modules/leveling-plans/student-plans.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { CLOCK, type Clock } from 'src/shared/clock/clock';
import { CoinLedger, lockStudentProfile } from 'src/shared/coins/coin-ledger';
import { COINS_FIRST_TRY, COINS_SECOND_TRY } from 'src/shared/coins/coin-rules';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';
import { isUniqueViolation } from 'src/shared/prisma/unique-violation';
import { StreakService } from 'src/shared/study/streak.service';

export const QUESTION_NOT_FOUND = 'Questão não encontrada.';
export const QUESTION_FINISHED = 'Você já terminou esta questão.';
/** Índices únicos parciais de `question_attempts` (um por contexto). */
const ATTEMPT_INDEXES = [
  'question_attempts_practice_key',
  'question_attempts_chapter_key',
] as const;

@Injectable()
export class AnswersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coins: CoinLedger,
    private readonly streaks: StreakService,
    private readonly plans: StudentPlansService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Registra uma resposta numa única transação.
   *
   * Concorrência: a transação começa travando a linha do perfil do aluno
   * (`FOR UPDATE`, o mesmo primeiro lock de `CoinLedger` e `StreakService`).
   * Com `plan_chapter_id`, o segundo lock é `FOR SHARE` na linha do plano
   * (fecha a corrida com a remoção de questões do plano).
   * Respostas simultâneas do mesmo aluno se serializam aqui: a segunda só lê as
   * tentativas depois que a primeira confirmou, então o 409 normalmente sai da
   * pré-checagem e a transação nunca aborta. Como rede de segurança, se o
   * índice único parcial ainda disparar (P2002 aborta a transação do Postgres),
   * o erro é traduzido para o mesmo 409 FORA da transação.
   *
   * A questão é travada com `FOR SHARE` (depois do perfil) para a política de
   * edição: um `PUT` que troca a alternativa correta trava a linha da questão
   * e só então conta as tentativas, então ou a tentativa já existe (o `PUT`
   * recebe 409) ou a resposta lê a correta já trocada.
   */
  async answer(user: AuthUser, dto: AnswerDto): Promise<ApiAnswerResult> {
    try {
      const outcome = await this.prisma.$transaction((tx) =>
        this.record(tx, user.id, dto),
      );
      return presentAnswerResult(outcome);
    } catch (error) {
      if (ATTEMPT_INDEXES.some((index) => isUniqueViolation(error, index))) {
        throw new BusinessRuleException(QUESTION_FINISHED);
      }
      throw error;
    }
  }

  async stats(user: AuthUser): Promise<ApiStudentStats> {
    const profile = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { userId: user.id },
      select: { coinsBalance: true, currentStreak: true, bestStreak: true },
    });
    return {
      coins_balance: profile.coinsBalance,
      current_streak: profile.currentStreak,
      best_streak: profile.bestStreak,
    };
  }

  private async record(
    tx: Prisma.TransactionClient,
    studentId: number,
    dto: AnswerDto,
  ): Promise<AnswerOutcome> {
    await lockStudentProfile(tx, studentId);
    // Contexto: prática livre (plan_chapter_id ausente) ou capítulo de plano.
    const chapterId = dto.plan_chapter_id ?? null;
    const chapterPlan =
      chapterId === null
        ? null
        : await this.plans.enterChapter(tx, studentId, chapterId);
    const locked = await tx.$queryRaw<{ id: number }[]>`
      SELECT "id" FROM "questions"
      WHERE "id" = ${dto.question_id} AND "active" FOR SHARE`;
    if (locked.length === 0) {
      throw new NotFoundException(QUESTION_NOT_FOUND);
    }
    if (
      chapterId !== null &&
      !(await this.plans.chapterHasQuestion(tx, chapterId, dto.question_id))
    ) {
      throw new NotFoundException(QUESTION_NOT_FOUND);
    }
    const question = await tx.question.findUniqueOrThrow({
      where: { id: dto.question_id },
      select: {
        explanation: true,
        options: { select: { id: true, letter: true, isCorrect: true } },
      },
    });

    const previous = await tx.questionAttempt.findMany({
      where: {
        studentId,
        questionId: dto.question_id,
        planChapterId: chapterId,
      },
      select: { isCorrect: true },
    });
    if (previous.length >= 2 || previous.some((a) => a.isCorrect)) {
      throw new BusinessRuleException(QUESTION_FINISHED);
    }
    const attemptNumber = (previous.length + 1) as 1 | 2;

    const selected = question.options.find(
      (option) => option.letter === dto.selected_letter,
    );
    const correct = question.options.find((option) => option.isCorrect);
    if (!selected || !correct) {
      // Questão sem as 5 alternativas ou sem correta: dado corrompido.
      throw new Error(`Questão ${dto.question_id} com alternativas inválidas.`);
    }
    const isCorrect = selected.isCorrect;

    // RN04: moedas uma vez por questão em qualquer contexto; `applied` diz se
    // este crédito foi o primeiro.
    let coinsAwarded = 0;
    if (isCorrect) {
      const amount = attemptNumber === 1 ? COINS_FIRST_TRY : COINS_SECOND_TRY;
      const { applied } = await this.coins.credit(tx, {
        studentId,
        amount,
        reason: 'correct_answer',
        sourceType: 'question',
        sourceId: dto.question_id,
      });
      coinsAwarded = applied ? amount : 0;
    }
    await tx.questionAttempt.create({
      data: {
        studentId,
        questionId: dto.question_id,
        planChapterId: chapterId,
        selectedOptionId: selected.id,
        attemptNumber,
        isCorrect,
        coinsAwarded,
      },
      select: { id: true },
    });

    const streak = await this.streaks.register(tx, studentId, this.clock.now());
    const completion =
      chapterId === null || chapterPlan === null
        ? undefined
        : await this.plans.completeAfterAnswer(
            tx,
            studentId,
            chapterPlan.planId,
            chapterId,
          );
    // Depois do bônus do plano, para o saldo devolvido já incluí-lo.
    const { coinsBalance } = await tx.studentProfile.findUniqueOrThrow({
      where: { userId: studentId },
      select: { coinsBalance: true },
    });
    return {
      isCorrect,
      attemptNumber,
      coinsAwarded,
      coinsBalance,
      correctLetter: correct.letter,
      explanation: question.explanation,
      streak,
      ...completion,
    };
  }
}
