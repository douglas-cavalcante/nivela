import { Injectable } from '@nestjs/common';
import type { Prisma } from 'src/generated/prisma/client';
import {
  resolvePlanState,
  type ResolvedPlan,
} from 'src/modules/leveling-plans/chapter-states';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoinLedger, lockStudentProfile } from 'src/shared/coins/coin-ledger';

/** Estado resolvido de um (aluno, plano), com a data gravada da conclusão. */
export interface StudentPlanState extends ResolvedPlan {
  /** `plan_completions.completed_at`, ou `null` se ainda não foi gravada. */
  completedAt: Date | null;
}

/** Estados por aluno e, dentro de cada aluno, por plano. */
export type PlanStates = Map<number, Map<number, StudentPlanState>>;

/**
 * O que assentar ao ler: `plan` só a conclusão do plano ainda não gravada
 * (lista do aluno e leituras da equipe); `any` também capítulos derivados
 * sem linha (detalhe do plano e fim do capítulo).
 */
export type SettleScope = 'plan' | 'any';

/** O estado de um (aluno, plano) devolvido por `load`/`loadSettled`. */
export function stateOf(
  states: PlanStates,
  studentId: number,
  planId: number,
): StudentPlanState {
  const state = states.get(studentId)?.get(planId);
  if (!state) {
    throw new Error(
      `Estado do aluno ${studentId} no plano ${planId} não carregado.`,
    );
  }
  return state;
}

export interface ChapterResult {
  chapter: { completed: boolean; next_chapter_id: number | null };
  plan: { completed: boolean; bonus_awarded: number };
}

/**
 * Ruling 11: fonte única da conclusão de capítulos e planos. Todas as
 * leituras (aluno: lista, detalhe, capítulo; equipe: progresso do plano e
 * ficha do aluno) e todo assentamento passam por `load` + `resolvePlanState`,
 * então aluno e equipe sempre veem o mesmo estado.
 */
@Injectable()
export class PlanCompletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coins: CoinLedger,
  ) {}

  /** Estado de cada aluno em cada plano (planos sem capítulo incluídos). */
  async load(
    client: Prisma.TransactionClient,
    studentIds: number[],
    planIds: number[],
  ): Promise<PlanStates> {
    const result: PlanStates = new Map(
      studentIds.map((id) => [id, new Map<number, StudentPlanState>()]),
    );
    if (studentIds.length === 0 || planIds.length === 0) {
      return result;
    }
    // Consultas em sequência: `client` pode ser uma transação (uma conexão).
    const chapters = await client.planChapter.findMany({
      where: { levelingPlanId: { in: planIds } },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        levelingPlanId: true,
        title: true,
        position: true,
        questions: {
          where: { question: { active: true } },
          select: { questionId: true },
        },
        completions: {
          where: { studentId: { in: studentIds } },
          select: { studentId: true },
        },
      },
    });
    // Tentativas terminadas (acerto ou 2ª tentativa) nos capítulos, inclusive
    // de questões desativadas depois: contam para a Ruling 9.
    const finished = await client.questionAttempt.findMany({
      where: {
        studentId: { in: studentIds },
        planChapterId: { in: chapters.map((chapter) => chapter.id) },
        OR: [{ isCorrect: true }, { attemptNumber: 2 }],
      },
      select: { studentId: true, planChapterId: true, questionId: true },
    });
    const recordedPlans = await client.planCompletion.findMany({
      where: { studentId: { in: studentIds }, levelingPlanId: { in: planIds } },
      select: { studentId: true, levelingPlanId: true, completedAt: true },
    });

    const key = (studentId: number, id: number) => `${studentId}:${id}`;
    const finishedIn = new Map<string, Set<number>>();
    for (const row of finished) {
      if (row.planChapterId === null) continue;
      const k = key(row.studentId, row.planChapterId);
      const set = finishedIn.get(k) ?? new Set<number>();
      set.add(row.questionId);
      finishedIn.set(k, set);
    }
    const completedAt = new Map(
      recordedPlans.map((row) => [
        key(row.studentId, row.levelingPlanId),
        row.completedAt,
      ]),
    );
    const byPlan = new Map<number, typeof chapters>();
    for (const chapter of chapters) {
      byPlan.set(chapter.levelingPlanId, [
        ...(byPlan.get(chapter.levelingPlanId) ?? []),
        chapter,
      ]);
    }

    for (const studentId of studentIds) {
      const states = result.get(studentId) as Map<number, StudentPlanState>;
      for (const planId of planIds) {
        const planChapters = byPlan.get(planId) ?? [];
        const progress = planChapters.map((chapter) => {
          const done = finishedIn.get(key(studentId, chapter.id));
          return {
            id: chapter.id,
            title: chapter.title,
            position: chapter.position,
            total: chapter.questions.length,
            answered: chapter.questions.filter((q) => done?.has(q.questionId))
              .length,
            recorded: chapter.completions.some(
              (row) => row.studentId === studentId,
            ),
          };
        });
        const recordedAt = completedAt.get(key(studentId, planId)) ?? null;
        states.set(planId, {
          ...resolvePlanState({
            chapters: progress,
            recorded: recordedAt !== null,
            hasFinishedAttempt: planChapters.some(
              (chapter) =>
                (finishedIn.get(key(studentId, chapter.id))?.size ?? 0) > 0,
            ),
          }),
          completedAt: recordedAt,
        });
      }
    }
    return result;
  }

  /** `load` para um aluno só. */
  async loadFor(
    client: Prisma.TransactionClient,
    studentId: number,
    planIds: number[],
  ): Promise<Map<number, StudentPlanState>> {
    return (
      (await this.load(client, [studentId], planIds)).get(studentId) ??
      new Map<number, StudentPlanState>()
    );
  }

  /**
   * Resolve e assenta o que está pendente (uma transação por par aluno/plano,
   * na ordem de travas de sempre) e devolve o estado já gravado. Sem nada
   * pendente, não escreve.
   */
  async loadSettled(
    studentIds: number[],
    planIds: number[],
    scope: SettleScope,
  ): Promise<PlanStates> {
    const states = await this.load(this.prisma, studentIds, planIds);
    let settled = false;
    for (const [studentId, plans] of states) {
      for (const [planId, state] of plans) {
        const pending =
          state.pendingPlan ||
          (scope === 'any' && state.pendingChapters.length > 0);
        if (pending) {
          await this.settle(studentId, planId);
          settled = true;
        }
      }
    }
    return settled ? this.load(this.prisma, studentIds, planIds) : states;
  }

  /**
   * Ruling 6: assenta, de forma idempotente, as conclusões pendentes do aluno
   * no plano, numa transação (perfil `FOR UPDATE`, depois plano `FOR SHARE`).
   */
  async settle(studentId: number, planId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockStudentProfile(tx, studentId);
      const locked = await tx.$queryRaw<{ id: number }[]>`
        SELECT "id" FROM "leveling_plans" WHERE "id" = ${planId} FOR SHARE`;
      if (locked.length > 0) {
        await this.settleInTx(tx, studentId, planId, null);
      }
    });
  }

  /**
   * Na transação de quem chama (perfil e plano já travados): grava
   * `chapter_completions` de todo capítulo concluído derivado, inclusive os
   * vazios (Ruling 11: adicionar questão depois não tranca o seguinte), e,
   * com o plano concluído pela regra única (Ruling 9), a conclusão do plano e
   * o bônus (RN07). As PKs e o índice único do extrato garantem uma vez só.
   * `chapterId` é o capítulo da resposta, para reportar a transição.
   */
  async settleInTx(
    tx: Prisma.TransactionClient,
    studentId: number,
    planId: number,
    chapterId: number | null,
  ): Promise<ChapterResult> {
    const state = (await this.loadFor(tx, studentId, [planId])).get(planId);
    const chapters = state?.chapters ?? [];
    const pending = state?.pendingChapters ?? [];
    if (pending.length > 0) {
      await tx.chapterCompletion.createMany({
        data: pending.map((item) => ({ studentId, planChapterId: item.id })),
        skipDuplicates: true,
      });
    }
    const index = chapters.findIndex((item) => item.id === chapterId);
    const chapterDone = index >= 0 && chapters[index].completed;
    // "Concluído POR ESTA resposta": só a transição (ainda não registrado) conta.
    const chapterJustDone =
      chapterDone && pending.some((item) => item.id === chapterId);

    let planDone = false;
    let bonusAwarded = 0;
    if (state?.pendingPlan) {
      const { count } = await tx.planCompletion.createMany({
        data: [{ studentId, levelingPlanId: planId }],
        skipDuplicates: true,
      });
      if (count === 1) {
        planDone = true;
        const { completionBonus } = await tx.levelingPlan.findUniqueOrThrow({
          where: { id: planId },
          select: { completionBonus: true },
        });
        if (completionBonus > 0) {
          const { applied } = await this.coins.credit(tx, {
            studentId,
            amount: completionBonus,
            reason: 'plan_completed',
            sourceType: 'plan',
            sourceId: planId,
          });
          bonusAwarded = applied ? completionBonus : 0;
        }
        await tx.planCompletion.update({
          where: {
            studentId_levelingPlanId: { studentId, levelingPlanId: planId },
          },
          data: { bonusAwarded },
        });
      }
    }

    return {
      chapter: {
        completed: chapterJustDone,
        next_chapter_id: chapterDone ? (chapters[index + 1]?.id ?? null) : null,
      },
      plan: { completed: planDone, bonus_awarded: bonusAwarded },
    };
  }
}
