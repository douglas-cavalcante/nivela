import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ApiList,
  ApiMyPlan,
  ApiMyPlanSummary,
} from '@nivela/api-contract';
import type { Prisma } from 'src/generated/prisma/client';
import {
  PlanCompletionService,
  stateOf,
  type ChapterResult,
} from 'src/modules/leveling-plans/plan-completion.service';
import { PLAN_NOT_FOUND } from 'src/modules/leveling-plans/plans.service';
import {
  presentMyPlan,
  presentMyPlanSummary,
} from 'src/modules/leveling-plans/presenters/my-plan.presenter';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
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
  }) satisfies Prisma.LevelingPlanSelect;

/** O prazo mais próximo entre as atribuições que alcançam o aluno. */
function earliest(rows: Array<{ dueDate: Date | null }>): Date | null {
  const dates = rows.flatMap((row) => (row.dueDate ? [row.dueDate] : []));
  return dates.length === 0 ? null : dates.reduce((a, b) => (a <= b ? a : b));
}

@Injectable()
export class StudentPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly completion: PlanCompletionService,
  ) {}

  /** Planos publicados que alcançam o aluno: não concluídos primeiro, depois prazo e título. */
  async list(user: AuthUser): Promise<ApiList<ApiMyPlanSummary>> {
    const plans = await this.prisma.levelingPlan.findMany({
      where: studentPlanScope(user.id),
      select: MY_PLAN_SELECT(user.id),
    });
    // Ruling 11: plano concluído (derivado) ainda não gravado é assentado aqui,
    // com o bônus, para a lista nunca mostrar conclusão sem pagamento.
    const states = await this.completion.loadSettled(
      [user.id],
      plans.map((plan) => plan.id),
      'plan',
    );
    const rows = plans.map((plan) => {
      const state = stateOf(states, user.id, plan.id);
      const dueDate = earliest(plan.assignments);
      return {
        plan,
        dueDate,
        completed: state.completed,
        summary: presentMyPlanSummary(
          plan,
          state.chapters,
          dueDate,
          state.completed,
        ),
      };
    });
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
    // Rulings 6 e 11: assenta conclusões pendentes (questão desativada
    // depois, capítulo vazio); sem pendência, não escreve.
    const states = await this.completion.loadSettled(
      [user.id],
      [plan.id],
      'any',
    );
    const state = stateOf(states, user.id, plan.id);
    return presentMyPlan(
      plan,
      state.chapters,
      earliest(plan.assignments),
      state.completed,
    );
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
      await this.completion.loadFor(this.prisma, studentId, [plan.id])
    ).get(plan.id)?.chapters;
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
    const chapters = (
      await this.completion.loadFor(tx, studentId, [planId])
    ).get(planId)?.chapters;
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
   * Depois de gravar a tentativa terminada: assenta capítulos e plano pela
   * regra única (`PlanCompletionService.settleInTx`) e devolve a transição.
   */
  async completeAfterAnswer(
    tx: Prisma.TransactionClient,
    studentId: number,
    planId: number,
    chapterId: number,
  ): Promise<ChapterResult> {
    return this.completion.settleInTx(tx, studentId, planId, chapterId);
  }

  /** Ruling 6: assenta as conclusões pendentes do aluno no plano. */
  async settle(studentId: number, planId: number): Promise<void> {
    await this.completion.settle(studentId, planId);
  }
}
