import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ApiPlan, ApiPlanSummary, Paginated } from '@nivela/api-contract';
import type { Prisma } from 'src/generated/prisma/client';
import type { ListPlansQuery } from 'src/modules/leveling-plans/dto/list-plans.query';
import type { PlanDto } from 'src/modules/leveling-plans/dto/plan.dto';
import {
  presentPlan,
  presentPlanSummary,
} from 'src/modules/leveling-plans/presenters/plan.presenter';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { CLOCK, type Clock } from 'src/shared/clock/clock';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';
import { paginate, toPrismaPage } from 'src/shared/pagination/paginate';
import { containsInsensitive } from 'src/shared/prisma/contains-insensitive';
import { planScope } from 'src/shared/scopes/plan-scope';

export const PLAN_NOT_FOUND = 'Plano não encontrado.';
export const HAS_PROGRESS =
  'O plano já tem progresso de alunos; não é possível remover capítulos ou questões.';
const SUBJECT_NOT_FOUND = 'Disciplina não encontrada.';
const SUBJECT_LOCKED =
  'Remova as questões do plano antes de trocar a disciplina.';
const EMPTY_CHAPTER =
  'Adicione ao menos um capítulo com questões antes de publicar.';
const ONLY_DRAFT = 'Só é possível excluir planos em rascunho.';

const SUMMARY_INCLUDE = {
  subject: { select: { id: true, name: true, color: true } },
  teacher: { select: { id: true, name: true } },
  _count: { select: { chapters: true, assignments: true } },
  chapters: { select: { _count: { select: { questions: true } } } },
} satisfies Prisma.LevelingPlanInclude;

const DETAIL_INCLUDE = {
  subject: SUMMARY_INCLUDE.subject,
  teacher: SUMMARY_INCLUDE.teacher,
  _count: SUMMARY_INCLUDE._count,
  chapters: {
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      title: true,
      position: true,
      _count: { select: { questions: true } },
      questions: {
        orderBy: [{ position: 'asc' }, { questionId: 'asc' }],
        select: {
          question: {
            select: {
              id: true,
              statement: true,
              difficulty: true,
              active: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.LevelingPlanInclude;

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(
    query: ListPlansQuery,
    user: AuthUser,
  ): Promise<Paginated<ApiPlanSummary>> {
    const filters: Prisma.LevelingPlanWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.subject_id ? { subjectId: query.subject_id } : {}),
      ...(query.search ? { title: containsInsensitive(query.search) } : {}),
    };
    const where: Prisma.LevelingPlanWhereInput = {
      AND: [planScope(user), filters],
    };
    const [rows, total] = await Promise.all([
      this.prisma.levelingPlan.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        include: SUMMARY_INCLUDE,
        ...toPrismaPage(query),
      }),
      this.prisma.levelingPlan.count({ where }),
    ]);
    return paginate(rows.map(presentPlanSummary), total, query);
  }

  /** Plano completo (capítulos e questões em ordem); 404 se fora do escopo. */
  async findOne(id: number, user: AuthUser): Promise<ApiPlan> {
    const plan = await this.prisma.levelingPlan.findFirst({
      where: { AND: [{ id }, planScope(user)] },
      include: DETAIL_INCLUDE,
    });
    if (!plan) {
      throw new NotFoundException(PLAN_NOT_FOUND);
    }
    const attempt = await this.prisma.questionAttempt.findFirst({
      where: { planChapter: { levelingPlanId: id } },
      select: { id: true },
    });
    return presentPlan(plan, attempt !== null);
  }

  async create(dto: PlanDto, user: AuthUser): Promise<ApiPlan> {
    await this.assertSubject(dto.subject_id);
    const plan = await this.prisma.levelingPlan.create({
      data: {
        teacherId: user.id,
        subjectId: dto.subject_id,
        title: dto.title,
        description: dto.description ?? null,
        completionBonus: dto.completion_bonus,
      },
      select: { id: true },
    });
    return this.findOne(plan.id, user);
  }

  async update(id: number, dto: PlanDto, user: AuthUser): Promise<ApiPlan> {
    await this.assertSubject(dto.subject_id);
    await this.prisma.$transaction(async (tx) => {
      // Trava e confere o escopo na própria escrita (404 se fora dele).
      const plan = await this.lockPlan(tx, id, user);
      if (plan.subjectId !== dto.subject_id) {
        // Trocar a disciplina deixaria questões de outra disciplina no plano.
        const linked = await tx.chapterQuestion.count({
          where: { planChapter: { levelingPlanId: id } },
        });
        if (linked > 0) {
          throw new FieldValidationException({
            subject_id: [SUBJECT_LOCKED],
          });
        }
      }
      await tx.levelingPlan.update({
        where: { id },
        data: {
          title: dto.title,
          // undefined = não mexe; null = limpa a descrição.
          description: dto.description,
          subjectId: dto.subject_id,
          completionBonus: dto.completion_bonus,
        },
        select: { id: true },
      });
    });
    return this.findOne(id, user);
  }

  /**
   * Publica o plano: exige ao menos um capítulo e questões em todos eles.
   * Publicar de novo um plano publicado é inofensivo.
   */
  async publish(id: number, user: AuthUser): Promise<ApiPlan> {
    await this.prisma.$transaction(async (tx) => {
      const plan = await this.lockPlan(tx, id, user);
      if (plan.status === 'published') {
        return;
      }
      const chapters = await tx.planChapter.findMany({
        where: { levelingPlanId: id },
        select: { _count: { select: { questions: true } } },
      });
      if (
        chapters.length === 0 ||
        chapters.some((chapter) => chapter._count.questions === 0)
      ) {
        throw new BusinessRuleException(EMPTY_CHAPTER);
      }
      await tx.levelingPlan.update({
        where: { id },
        data: { status: 'published', publishedAt: this.clock.now() },
        select: { id: true },
      });
    });
    return this.findOne(id, user);
  }

  /** Só rascunho sem atribuições. */
  async remove(id: number, user: AuthUser): Promise<void> {
    const { count } = await this.prisma.levelingPlan.deleteMany({
      where: {
        id,
        status: 'draft',
        assignments: { none: {} },
        AND: [planScope(user)],
      },
    });
    if (count > 0) {
      return;
    }
    const visible = await this.prisma.levelingPlan.findFirst({
      where: { AND: [{ id }, planScope(user)] },
      select: { id: true },
    });
    throw visible
      ? new BusinessRuleException(ONLY_DRAFT)
      : new NotFoundException(PLAN_NOT_FOUND);
  }

  /**
   * Trava a linha do plano (serializa edições concorrentes de capítulos e
   * questões) e confere o escopo na própria escrita: o `updateMany` com
   * `planScope` não toca em plano alheio. Devolve os dados que as regras usam.
   */
  async lockPlan(tx: Prisma.TransactionClient, id: number, user: AuthUser) {
    const { count } = await tx.levelingPlan.updateMany({
      where: { AND: [{ id }, planScope(user)] },
      data: { updatedAt: this.clock.now() },
    });
    if (count === 0) {
      throw new NotFoundException(PLAN_NOT_FOUND);
    }
    return tx.levelingPlan.findUniqueOrThrow({
      where: { id },
      select: { id: true, subjectId: true, status: true },
    });
  }

  private async assertSubject(subjectId: number): Promise<void> {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true },
    });
    if (!subject) {
      throw new FieldValidationException({ subject_id: [SUBJECT_NOT_FOUND] });
    }
  }
}
