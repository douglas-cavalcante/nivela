import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApiPlan } from '@nivela/api-contract';
import type { Prisma } from 'src/generated/prisma/client';
import type { ChapterDto } from 'src/modules/leveling-plans/dto/chapter.dto';
import { QUESTIONS_MESSAGE } from 'src/modules/leveling-plans/dto/chapter-questions.dto';
import {
  HAS_PROGRESS,
  PlansService,
} from 'src/modules/leveling-plans/plans.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';
import { isForeignKeyViolation } from 'src/shared/prisma/foreign-key-violation';
import { isUniqueViolation } from 'src/shared/prisma/unique-violation';
import { planScope } from 'src/shared/scopes/plan-scope';

const CHAPTER_NOT_FOUND = 'Capítulo não encontrado.';
const ORDER_MESSAGE = 'Informe todos os capítulos do plano, sem repetir.';
/** FK das tentativas: protege capítulos que algum aluno já respondeu. */
const ATTEMPT_CHAPTER_FK = 'question_attempts_plan_chapter_id_fkey';
/** Únicos de posição (DEFERRABLE), conferidos no commit. */
const POSITION_KEYS = [
  'plan_chapters_position_key',
  'chapter_question_position_key',
] as const;

@Injectable()
export class ChaptersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {}

  async create(
    planId: number,
    dto: ChapterDto,
    user: AuthUser,
  ): Promise<ApiPlan> {
    await this.write(() =>
      this.prisma.$transaction(async (tx) => {
        await this.plans.lockPlan(tx, planId, user);
        const last = await tx.planChapter.aggregate({
          where: { levelingPlanId: planId },
          _max: { position: true },
        });
        await tx.planChapter.create({
          data: {
            levelingPlanId: planId,
            title: dto.title,
            position: (last._max.position ?? 0) + 1,
          },
          select: { id: true },
        });
      }),
    );
    return this.plans.findOne(planId, user);
  }

  async rename(
    planId: number,
    chapterId: number,
    dto: ChapterDto,
    user: AuthUser,
  ): Promise<ApiPlan> {
    await this.prisma.$transaction(async (tx) => {
      await this.plans.lockPlan(tx, planId, user);
      const { count } = await tx.planChapter.updateMany({
        where: this.chapterWhere(planId, chapterId, user),
        data: { title: dto.title },
      });
      if (count === 0) {
        throw new NotFoundException(CHAPTER_NOT_FOUND);
      }
    });
    return this.plans.findOne(planId, user);
  }

  /** RN08: plano com progresso de alunos não perde capítulos. */
  async remove(
    planId: number,
    chapterId: number,
    user: AuthUser,
  ): Promise<ApiPlan> {
    await this.write(() =>
      this.prisma.$transaction(async (tx) => {
        await this.plans.lockPlan(tx, planId, user);
        const chapter = await tx.planChapter.findFirst({
          where: this.chapterWhere(planId, chapterId, user),
          select: { position: true },
        });
        if (!chapter) {
          throw new NotFoundException(CHAPTER_NOT_FOUND);
        }
        await this.assertNoProgress(tx, planId);
        await tx.planChapter.deleteMany({
          where: this.chapterWhere(planId, chapterId, user),
        });
        // Fecha o buraco: as posições só são conferidas no commit.
        await tx.$executeRaw`
          UPDATE plan_chapters SET position = position - 1
          WHERE leveling_plan_id = ${planId} AND position > ${chapter.position}`;
      }),
    );
    return this.plans.findOne(planId, user);
  }

  /** Nova ordem dos capítulos: precisa listar exatamente os capítulos do plano. */
  async reorder(
    planId: number,
    chapterIds: number[],
    user: AuthUser,
  ): Promise<ApiPlan> {
    await this.write(() =>
      this.prisma.$transaction(async (tx) => {
        await this.plans.lockPlan(tx, planId, user);
        const current = await tx.planChapter.findMany({
          where: { levelingPlanId: planId },
          select: { id: true },
        });
        const wanted = new Set(chapterIds);
        if (
          wanted.size !== chapterIds.length ||
          chapterIds.length !== current.length ||
          current.some((chapter) => !wanted.has(chapter.id))
        ) {
          throw new FieldValidationException({ chapter_ids: [ORDER_MESSAGE] });
        }
        // Os únicos de posição são DEFERRABLE INITIALLY DEFERRED: trocar
        // posições passa por estados repetidos dentro da transação.
        for (const [index, id] of chapterIds.entries()) {
          await tx.planChapter.update({
            where: { id },
            data: { position: index + 1 },
            select: { id: true },
          });
        }
      }),
    );
    return this.plans.findOne(planId, user);
  }

  /**
   * Substitui a lista de questões do capítulo (a ordem do array vira a
   * posição). Adicionar é sempre permitido; remover alguma questão de plano
   * com progresso é 409 (RN08).
   */
  async setQuestions(
    planId: number,
    chapterId: number,
    questionIds: number[],
    user: AuthUser,
  ): Promise<ApiPlan> {
    await this.write(() =>
      this.prisma.$transaction(async (tx) => {
        const plan = await this.plans.lockPlan(tx, planId, user);
        const chapter = await tx.planChapter.findFirst({
          where: this.chapterWhere(planId, chapterId, user),
          select: { id: true },
        });
        if (!chapter) {
          throw new NotFoundException(CHAPTER_NOT_FOUND);
        }
        if (new Set(questionIds).size !== questionIds.length) {
          throw new FieldValidationException({
            question_ids: [QUESTIONS_MESSAGE],
          });
        }

        const existing = await tx.chapterQuestion.findMany({
          where: { planChapterId: chapterId },
          select: { questionId: true },
        });
        const keptIds = new Set(existing.map((row) => row.questionId));
        // Só questões da disciplina do plano; as novas precisam estar ativas
        // (uma já presente no capítulo pode ser reordenada ou mantida mesmo
        // depois de desativada).
        const valid = await tx.question.findMany({
          where: {
            id: { in: questionIds },
            subjectId: plan.subjectId,
            OR: [{ active: true }, { id: { in: [...keptIds] } }],
          },
          select: { id: true },
        });
        if (valid.length !== questionIds.length) {
          throw new FieldValidationException({
            question_ids: [QUESTIONS_MESSAGE],
          });
        }

        const wanted = new Set(questionIds);
        const removed = existing.filter((row) => !wanted.has(row.questionId));
        if (removed.length > 0) {
          await this.assertNoProgress(tx, planId);
          await tx.chapterQuestion.deleteMany({
            where: {
              planChapterId: chapterId,
              questionId: { in: removed.map((row) => row.questionId) },
            },
          });
        }
        for (const [index, questionId] of questionIds.entries()) {
          if (keptIds.has(questionId)) {
            await tx.chapterQuestion.update({
              where: {
                planChapterId_questionId: {
                  planChapterId: chapterId,
                  questionId,
                },
              },
              data: { position: index + 1 },
              select: { position: true },
            });
          } else {
            await tx.chapterQuestion.create({
              data: {
                planChapterId: chapterId,
                questionId,
                position: index + 1,
              },
              select: { position: true },
            });
          }
        }
      }),
    );
    return this.plans.findOne(planId, user);
  }

  /** Capítulo do plano, sempre dentro do escopo do plano (RN15). */
  private chapterWhere(
    planId: number,
    chapterId: number,
    user: AuthUser,
  ): Prisma.PlanChapterWhereInput {
    return {
      id: chapterId,
      levelingPlanId: planId,
      levelingPlan: planScope(user),
    };
  }

  private async assertNoProgress(
    tx: Prisma.TransactionClient,
    planId: number,
  ): Promise<void> {
    const attempt = await tx.questionAttempt.findFirst({
      where: { planChapter: { levelingPlanId: planId } },
      select: { id: true },
    });
    if (attempt) {
      throw new BusinessRuleException(HAS_PROGRESS);
    }
  }

  /**
   * Traduz erros do banco: tentativa registrada entre a checagem e a remoção
   * (FK) vira o mesmo 409; posição repetida no commit (pedidos simultâneos
   * que escaparam do lock) vira 409 para tentar de novo.
   */
  private async write<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isForeignKeyViolation(error, ATTEMPT_CHAPTER_FK)) {
        throw new BusinessRuleException(HAS_PROGRESS);
      }
      if (POSITION_KEYS.some((key) => isUniqueViolation(error, key))) {
        throw new BusinessRuleException(
          'O plano foi alterado ao mesmo tempo. Tente de novo.',
        );
      }
      throw error;
    }
  }
}
