import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ApiList,
  ApiMyPlan,
  ApiMyPlanSummary,
} from '@nivela/api-contract';
import type { Prisma } from 'src/generated/prisma/client';
import {
  resolveChapterStates,
  type ResolvedChapter,
} from 'src/modules/leveling-plans/chapter-states';
import { PLAN_NOT_FOUND } from 'src/modules/leveling-plans/plans.service';
import {
  presentMyPlan,
  presentMyPlanSummary,
} from 'src/modules/leveling-plans/presenters/my-plan.presenter';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { CoinLedger, lockStudentProfile } from 'src/shared/coins/coin-ledger';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';
import {
  assignmentReaches,
  studentPlanScope,
} from 'src/shared/scopes/student-plan-scope';

export const CHAPTER_NOT_FOUND = 'Capítulo não encontrado.';
export const CHAPTER_LOCKED = 'Conclua o capítulo anterior para liberar este.';

const MY_PLAN_SELECT = (studentId: number) =>
  ({
    id: true,
    title: true,
    description: true,
    completionBonus: true,
    subject: { select: { id: true, name: true, color: true, icon: true } },
    assignments: {
      where: assignmentReaches(studentId),
      select: { dueDate: true },
    },
    completions: { where: { studentId }, select: { studentId: true } },
  }) satisfies Prisma.LevelingPlanSelect;

type MyPlanRow = Prisma.LevelingPlanGetPayload<{
  select: ReturnType<typeof MY_PLAN_SELECT>;
}>;

/** O prazo mais próximo entre as atribuições que alcançam o aluno. */
function earliest(rows: Array<{ dueDate: Date | null }>): Date | null {
  const dates = rows.flatMap((row) => (row.dueDate ? [row.dueDate] : []));
  return dates.length === 0 ? null : dates.reduce((a, b) => (a <= b ? a : b));
}

/** Concluído se registrado ou se todos os capítulos (ao menos um) estão concluídos. */
function isPlanDone(
  plan: { completions: unknown[] },
  chapters: ResolvedChapter[],
): boolean {
  return (
    plan.completions.length > 0 ||
    (chapters.length > 0 && chapters.every((chapter) => chapter.completed))
  );
}

export interface ChapterResult {
  chapter: { completed: boolean; next_chapter_id: number | null };
  plan: { completed: boolean; bonus_awarded: number };
}

@Injectable()
export class StudentPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coins: CoinLedger,
  ) {}

  /** Planos publicados que alcançam o aluno: não concluídos primeiro, depois prazo e título. */
  async list(user: AuthUser): Promise<ApiList<ApiMyPlanSummary>> {
    const plans = await this.prisma.levelingPlan.findMany({
      where: studentPlanScope(user.id),
      select: MY_PLAN_SELECT(user.id),
    });
    const chapters = await this.loadChapters(
      this.prisma,
      user.id,
      plans.map((plan) => plan.id),
    );
    const rows = plans.map((plan) => ({
      plan,
      dueDate: earliest(plan.assignments),
      completed: isPlanDone(plan, chapters.get(plan.id) ?? []),
      summary: presentMyPlanSummary(
        plan,
        chapters.get(plan.id) ?? [],
        earliest(plan.assignments),
        isPlanDone(plan, chapters.get(plan.id) ?? []),
      ),
    }));
    rows.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (a.dueDate?.getTime() !== b.dueDate?.getTime()) {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      }
      return (
        a.plan.title.localeCompare(b.plan.title, 'pt-BR') ||
        a.plan.id - b.plan.id
      );
    });
    return { data: rows.map((row) => row.summary) };
  }

  async detail(user: AuthUser, planId: number): Promise<ApiMyPlan> {
    const plan = await this.prisma.levelingPlan.findFirst({
      where: { AND: [{ id: planId }, studentPlanScope(user.id)] },
      select: MY_PLAN_SELECT(user.id),
    });
    if (!plan) {
      throw new NotFoundException(PLAN_NOT_FOUND);
    }
    // Ruling 6: assenta conclusões pendentes (questão desativada depois).
    await this.settle(user.id, plan.id);
    const [fresh, chapters] = await Promise.all([
      this.prisma.levelingPlan.findUniqueOrThrow({
        where: { id: plan.id },
        select: MY_PLAN_SELECT(user.id),
      }),
      this.loadChapters(this.prisma, user.id, [plan.id]),
    ]);
    return this.present(fresh, chapters.get(plan.id) ?? []);
  }

  /**
   * Capítulo do plano que o aluno pode ver (plano visível e capítulo dentro
   * dele) e que não está trancado. 404 plano/capítulo; 409 capítulo trancado.
   */
  async openChapter(
    studentId: number,
    planId: number,
    chapterId: number,
  ): Promise<{ id: number }> {
    const plan = await this.prisma.levelingPlan.findFirst({
      where: { AND: [{ id: planId }, studentPlanScope(studentId)] },
      select: { id: true },
    });
    if (!plan) {
      throw new NotFoundException(PLAN_NOT_FOUND);
    }
    const chapters = (
      await this.loadChapters(this.prisma, studentId, [plan.id])
    ).get(plan.id);
    const chapter = chapters?.find((item) => item.id === chapterId);
    if (!chapter) {
      throw new NotFoundException(CHAPTER_NOT_FOUND);
    }
    if (chapter.state === 'locked') {
      throw new BusinessRuleException(CHAPTER_LOCKED);
    }
    return { id: chapter.id };
  }

  /**
   * Primeiro passo de `POST /answers` com capítulo (já com o perfil do aluno
   * travado): `FOR SHARE` na linha do plano, que fecha a corrida com a remoção
   * de questões (Ruling 5), e então valida visibilidade (404) e desbloqueio
   * (409). Devolve o plano do capítulo.
   */
  async enterChapter(
    tx: Prisma.TransactionClient,
    studentId: number,
    chapterId: number,
  ): Promise<{ planId: number }> {
    const locked = await tx.$queryRaw<{ id: number }[]>`
      SELECT p."id" FROM "leveling_plans" p
      JOIN "plan_chapters" c ON c."leveling_plan_id" = p."id"
      WHERE c."id" = ${chapterId} FOR SHARE OF p`;
    if (locked.length === 0) {
      throw new NotFoundException(CHAPTER_NOT_FOUND);
    }
    const planId = locked[0].id;
    const visible = await tx.levelingPlan.findFirst({
      where: { AND: [{ id: planId }, studentPlanScope(studentId)] },
      select: { id: true },
    });
    if (!visible) {
      throw new NotFoundException(CHAPTER_NOT_FOUND);
    }
    const chapters = (await this.loadChapters(tx, studentId, [planId])).get(
      planId,
    );
    // Ruling 7: capítulo já concluído continua aceitando respostas (questões
    // adicionadas depois ficam alcançáveis); só o trancado é barrado.
    if (chapters?.find((item) => item.id === chapterId)?.state === 'locked') {
      throw new BusinessRuleException(CHAPTER_LOCKED);
    }
    return { planId };
  }

  /** A questão faz parte do capítulo (inclusive desativada: quem decide é o lock da questão). */
  async chapterHasQuestion(
    tx: Prisma.TransactionClient,
    chapterId: number,
    questionId: number,
  ): Promise<boolean> {
    const row = await tx.chapterQuestion.findUnique({
      where: {
        planChapterId_questionId: { planChapterId: chapterId, questionId },
      },
      select: { questionId: true },
    });
    return row !== null;
  }

  /**
   * Depois de gravar a tentativa: conclui o capítulo se todas as questões
   * ativas dele estão terminadas nele (a PK de `chapter_completions` evita
   * duplicar) e, se todos os capítulos do plano estão concluídos (Ruling 4),
   * registra a conclusão do plano e paga o bônus (RN07). A PK de
   * `plan_completions` e o índice único do extrato garantem uma vez só, mesmo
   * que o plano mude depois.
   */
  async completeAfterAnswer(
    tx: Prisma.TransactionClient,
    studentId: number,
    planId: number,
    chapterId: number,
  ): Promise<ChapterResult> {
    return this.settleInTx(tx, studentId, planId, chapterId);
  }

  /**
   * Ruling 6: assenta, de forma idempotente, as conclusões pendentes do aluno
   * no plano, numa transação (perfil `FOR UPDATE`, depois plano `FOR SHARE`).
   * Cobre a questão desativada depois de o aluno terminar as outras, que não
   * passa mais por `POST /answers`.
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
   * Registra `chapter_completions` dos capítulos derivados como concluídos
   * (a PK evita duplicar) e, com todos concluídos, a conclusão do plano e o
   * bônus (RN07). A PK de `plan_completions` e o índice único do extrato
   * garantem uma vez só, mesmo que o plano mude depois.
   */
  private async settleInTx(
    tx: Prisma.TransactionClient,
    studentId: number,
    planId: number,
    chapterId: number | null,
  ): Promise<ChapterResult> {
    const resolved =
      (await this.loadChapters(tx, studentId, [planId])).get(planId) ?? [];
    const pending = resolved.filter(
      (item) => item.completed && !item.recorded && item.total > 0,
    );
    if (pending.length > 0) {
      await tx.chapterCompletion.createMany({
        data: pending.map((item) => ({ studentId, planChapterId: item.id })),
        skipDuplicates: true,
      });
    }
    const index = resolved.findIndex((item) => item.id === chapterId);
    const chapterDone = index >= 0 && resolved[index].completed;
    // "Concluído POR ESTA resposta": só a transição (ainda não registrado) conta.
    const chapterJustDone =
      chapterDone && pending.some((item) => item.id === chapterId);
    const allDone =
      resolved.length > 0 && resolved.every((item) => item.completed);

    let planDone = false;
    let bonusAwarded = 0;
    if (allDone) {
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
        next_chapter_id: chapterDone ? (resolved[index + 1]?.id ?? null) : null,
      },
      plan: { completed: planDone, bonus_awarded: bonusAwarded },
    };
  }

  private present(plan: MyPlanRow, chapters: ResolvedChapter[]): ApiMyPlan {
    return presentMyPlan(
      plan,
      chapters,
      earliest(plan.assignments),
      isPlanDone(plan, chapters),
    );
  }

  /** Capítulos dos planos, na ordem, com estado e contagens do aluno. */
  private async loadChapters(
    client: Prisma.TransactionClient,
    studentId: number,
    planIds: number[],
  ): Promise<Map<number, ResolvedChapter[]>> {
    const result = new Map<number, ResolvedChapter[]>();
    if (planIds.length === 0) {
      return result;
    }
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
        completions: { where: { studentId }, select: { studentId: true } },
      },
    });
    const finished = await client.questionAttempt.findMany({
      where: {
        studentId,
        planChapterId: { in: chapters.map((chapter) => chapter.id) },
        OR: [{ isCorrect: true }, { attemptNumber: 2 }],
      },
      select: { planChapterId: true, questionId: true },
    });
    const finishedIn = new Map<number, Set<number>>();
    for (const row of finished) {
      if (row.planChapterId === null) continue;
      const set = finishedIn.get(row.planChapterId) ?? new Set<number>();
      set.add(row.questionId);
      finishedIn.set(row.planChapterId, set);
    }

    const byPlan = new Map<number, typeof chapters>();
    for (const chapter of chapters) {
      byPlan.set(chapter.levelingPlanId, [
        ...(byPlan.get(chapter.levelingPlanId) ?? []),
        chapter,
      ]);
    }
    for (const planId of planIds) {
      result.set(
        planId,
        resolveChapterStates(
          (byPlan.get(planId) ?? []).map((chapter) => {
            const done = finishedIn.get(chapter.id);
            return {
              id: chapter.id,
              title: chapter.title,
              position: chapter.position,
              total: chapter.questions.length,
              answered: chapter.questions.filter((q) => done?.has(q.questionId))
                .length,
              recorded: chapter.completions.length > 0,
            };
          }),
        ),
      );
    }
    return result;
  }
}
