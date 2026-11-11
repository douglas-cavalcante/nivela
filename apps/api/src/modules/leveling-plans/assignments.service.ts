import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ApiList, ApiPlanAssignment } from '@nivela/api-contract';
import type { AssignmentDto } from 'src/modules/leveling-plans/dto/assignment.dto';
import { PLAN_NOT_FOUND } from 'src/modules/leveling-plans/plans.service';
import { presentAssignment } from 'src/modules/leveling-plans/presenters/plan.presenter';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { CLOCK, type Clock } from 'src/shared/clock/clock';
import type { Prisma } from 'src/generated/prisma/client';
import { Role } from 'src/shared/enums/role.enum';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';
import { isUniqueViolation } from 'src/shared/prisma/unique-violation';
import { classroomScope } from 'src/shared/scopes/classroom-scope';
import { planScope } from 'src/shared/scopes/plan-scope';
import { studentScope } from 'src/shared/scopes/student-scope';
import { studyDay } from 'src/shared/study/study-day';

const NOT_PUBLISHED = 'Publique o plano antes de atribuir.';
const ASSIGNMENT_NOT_FOUND = 'Atribuição não encontrada.';
const CLASSROOM_NOT_FOUND = 'Turma não encontrada.';
const STUDENT_NOT_FOUND = 'Aluno não encontrado.';
const CHOOSE_TARGET = 'Informe uma turma ou um aluno, não os dois.';
const PAST_DUE_DATE = 'A data limite não pode ser no passado.';
const CLASSROOM_DUPLICATE = 'Este plano já foi atribuído a esta turma.';
const STUDENT_DUPLICATE = 'Este plano já foi atribuído a este aluno.';
/** Únicos parciais de `plan_assignments` (um por alvo). */
const CLASSROOM_KEY = 'plan_assignments_classroom_key';
const STUDENT_KEY = 'plan_assignments_student_key';

const ASSIGNMENT_SELECT = {
  id: true,
  dueDate: true,
  createdAt: true,
  classroom: { select: { id: true, name: true } },
  student: { select: { id: true, name: true } },
} as const;

/**
 * RN15: uma atribuição feita pelo administrador a uma turma ou aluno de outro
 * professor não aparece para o dono do plano. O administrador vê todas.
 */
function reachableTargets(user: AuthUser): Prisma.PlanAssignmentWhereInput {
  if (user.role === Role.Admin) {
    return {};
  }
  return {
    OR: [
      { classroomId: { not: null }, classroom: classroomScope(user) },
      { studentId: { not: null }, student: studentScope(user) },
    ],
  };
}

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(
    planId: number,
    user: AuthUser,
  ): Promise<ApiList<ApiPlanAssignment>> {
    await this.assertVisible(planId, user);
    const rows = await this.prisma.planAssignment.findMany({
      where: {
        levelingPlanId: planId,
        levelingPlan: planScope(user),
        ...reachableTargets(user),
      },
      select: ASSIGNMENT_SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return { data: rows.map(presentAssignment) };
  }

  /**
   * Atribui o plano a uma turma ou a um aluno do próprio professor (RN15: o
   * alvo passa por `classroomScope`/`studentScope`; fora dele é 422 no campo).
   */
  async create(
    planId: number,
    dto: AssignmentDto,
    user: AuthUser,
  ): Promise<ApiPlanAssignment> {
    const plan = await this.assertVisible(planId, user);
    if (plan.status !== 'published') {
      throw new BusinessRuleException(NOT_PUBLISHED);
    }
    const classroomId = dto.classroom_id ?? undefined;
    const studentId = dto.student_id ?? undefined;
    if ((classroomId === undefined) === (studentId === undefined)) {
      throw new FieldValidationException({
        [classroomId === undefined ? 'classroom_id' : 'student_id']: [
          CHOOSE_TARGET,
        ],
      });
    }
    const dueDate = this.parseDueDate(dto.due_date);
    await this.assertTarget(classroomId, studentId, user);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // O escopo vale também na escrita: `FOR SHARE` na linha do plano
        // (única trava desta transação) segura edições e exclusão do plano
        // até o commit, então o plano conferido aqui continua publicado e
        // visível enquanto a atribuição é gravada.
        const locked = await tx.$queryRaw<{ id: number }[]>`
          SELECT "id" FROM "leveling_plans" WHERE "id" = ${planId} FOR SHARE`;
        const stillVisible =
          locked.length > 0 &&
          (await tx.levelingPlan.findFirst({
            where: {
              AND: [{ id: planId, status: 'published' }, planScope(user)],
            },
            select: { id: true },
          }));
        if (!stillVisible) {
          throw new NotFoundException(PLAN_NOT_FOUND);
        }
        const created = await tx.planAssignment.create({
          data: {
            levelingPlanId: planId,
            classroomId: classroomId ?? null,
            studentId: studentId ?? null,
            dueDate,
          },
          select: ASSIGNMENT_SELECT,
        });
        return presentAssignment(created);
      });
    } catch (error) {
      if (isUniqueViolation(error, CLASSROOM_KEY)) {
        throw new FieldValidationException({
          classroom_id: [CLASSROOM_DUPLICATE],
        });
      }
      if (isUniqueViolation(error, STUDENT_KEY)) {
        throw new FieldValidationException({ student_id: [STUDENT_DUPLICATE] });
      }
      throw error;
    }
  }

  async remove(
    planId: number,
    assignmentId: number,
    user: AuthUser,
  ): Promise<void> {
    await this.assertVisible(planId, user);
    // RN15: o mesmo filtro da lista; o professor não remove (nem descobre) a
    // atribuição que o administrador fez fora das turmas dele.
    const { count } = await this.prisma.planAssignment.deleteMany({
      where: {
        id: assignmentId,
        levelingPlanId: planId,
        levelingPlan: planScope(user),
        ...reachableTargets(user),
      },
    });
    if (count === 0) {
      throw new NotFoundException(ASSIGNMENT_NOT_FOUND);
    }
  }

  /** Data limite (`AAAA-MM-DD`) de hoje em diante, no dia de estudo de Fortaleza. */
  private parseDueDate(value: string | null | undefined): Date | null {
    if (value === undefined || value === null) {
      return null;
    }
    // Comparação de texto `AAAA-MM-DD` equivale à de datas.
    if (value < studyDay(this.clock.now())) {
      throw new FieldValidationException({ due_date: [PAST_DUE_DATE] });
    }
    return new Date(`${value}T00:00:00.000Z`);
  }

  private async assertTarget(
    classroomId: number | undefined,
    studentId: number | undefined,
    user: AuthUser,
  ): Promise<void> {
    if (classroomId !== undefined) {
      const classroom = await this.prisma.classroom.findFirst({
        where: { AND: [{ id: classroomId }, classroomScope(user)] },
        select: { id: true },
      });
      if (!classroom) {
        throw new FieldValidationException({
          classroom_id: [CLASSROOM_NOT_FOUND],
        });
      }
      return;
    }
    const student = await this.prisma.user.findFirst({
      where: { AND: [{ id: studentId }, studentScope(user)] },
      select: { id: true },
    });
    if (!student) {
      throw new FieldValidationException({ student_id: [STUDENT_NOT_FOUND] });
    }
  }

  /** 404 se o plano não existe ou está fora do escopo de quem pede. */
  private async assertVisible(
    planId: number,
    user: AuthUser,
  ): Promise<{ id: number; status: string }> {
    const plan = await this.prisma.levelingPlan.findFirst({
      where: { AND: [{ id: planId }, planScope(user)] },
      select: { id: true, status: true },
    });
    if (!plan) {
      throw new NotFoundException(PLAN_NOT_FOUND);
    }
    return plan;
  }
}
