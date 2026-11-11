import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ApiList,
  ApiPlanProgressRow,
  ApiStudentPlanProgress,
} from '@nivela/api-contract';
import { Prisma } from 'src/generated/prisma/client';
import {
  PlanCompletionService,
  stateOf,
  type StudentPlanState,
} from 'src/modules/leveling-plans/plan-completion.service';
import { PLAN_NOT_FOUND } from 'src/modules/leveling-plans/plans.service';
import {
  presentProgressRow,
  presentStudentPlan,
} from 'src/modules/leveling-plans/presenters/plan.presenter';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { planScope } from 'src/shared/scopes/plan-scope';
import { assignmentReaches } from 'src/shared/scopes/student-plan-scope';
import { studentScope } from 'src/shared/scopes/student-scope';

const STUDENT_NOT_FOUND = 'Aluno não encontrado.';

interface AttemptTotals {
  student_id: number;
  answered: number;
  correct: number;
}

@Injectable()
export class PlanProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly completion: PlanCompletionService,
  ) {}

  /**
   * Progresso dos alunos atribuídos ao plano, diretamente ou pela turma (cada
   * aluno aparece uma vez), por nome. Respondidas e acertos contam questões
   * distintas do plano; capítulos e conclusão vêm do mesmo resolvedor do
   * aluno (Ruling 11), que assenta antes a conclusão derivada ainda não
   * gravada (para `completed_at` existir).
   */
  async progress(
    planId: number,
    user: AuthUser,
  ): Promise<ApiList<ApiPlanProgressRow>> {
    const plan = await this.prisma.levelingPlan.findFirst({
      where: { AND: [{ id: planId }, planScope(user)] },
      select: { id: true, chapters: { select: { id: true } } },
    });
    if (!plan) {
      throw new NotFoundException(PLAN_NOT_FOUND);
    }
    const assignments = await this.prisma.planAssignment.findMany({
      where: { levelingPlanId: planId, levelingPlan: planScope(user) },
      select: { classroomId: true, studentId: true },
    });
    const classroomIds = assignments.flatMap((a) =>
      a.classroomId === null ? [] : [a.classroomId],
    );
    const directIds = assignments.flatMap((a) =>
      a.studentId === null ? [] : [a.studentId],
    );
    if (classroomIds.length === 0 && directIds.length === 0) {
      return { data: [] };
    }

    // `findMany` com OR já devolve cada aluno uma só vez (sem duplicar quem
    // chega pela turma e também direto).
    const students = await this.prisma.user.findMany({
      where: {
        // RN15: só alunos do escopo de quem pede (o administrador pode ter
        // atribuído o plano a alunos de outros professores).
        AND: [
          studentScope(user),
          {
            OR: [
              { id: { in: directIds } },
              { enrollments: { some: { classroomId: { in: classroomIds } } } },
            ],
          },
        ],
      },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    if (students.length === 0) {
      return { data: [] };
    }
    const studentIds = students.map((student) => student.id);
    const chapterIds = plan.chapters.map((chapter) => chapter.id);

    const states = await this.completion.loadSettled(
      studentIds,
      [planId],
      'plan',
    );
    const totals =
      chapterIds.length === 0
        ? []
        : await this.prisma.$queryRaw<AttemptTotals[]>`
            SELECT student_id,
                   count(DISTINCT question_id)::int AS answered,
                   (count(DISTINCT question_id) FILTER (WHERE is_correct))::int AS correct
            FROM question_attempts
            WHERE plan_chapter_id IN (${Prisma.join(chapterIds)})
              AND student_id IN (${Prisma.join(studentIds)})
            GROUP BY student_id`;
    const totalsByStudent = new Map(totals.map((row) => [row.student_id, row]));
    return {
      data: students.map((student) => {
        const state = stateOf(states, student.id, planId);
        return presentProgressRow({
          student,
          completedChapters: countCompleted(state),
          totalChapters: state.chapters.length,
          answered: totalsByStudent.get(student.id)?.answered ?? 0,
          correct: totalsByStudent.get(student.id)?.correct ?? 0,
          completedAt: state.completedAt,
        });
      }),
    };
  }

  /**
   * Planos do professor (ou todos, para o administrador) atribuídos ao aluno,
   * diretamente ou pela turma dele, com o andamento. O aluno precisa estar no
   * `studentScope` de quem pede (404 caso contrário).
   */
  async forStudent(
    studentId: number,
    user: AuthUser,
  ): Promise<ApiList<ApiStudentPlanProgress>> {
    const student = await this.prisma.user.findFirst({
      where: { AND: [{ id: studentId }, studentScope(user)] },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException(STUDENT_NOT_FOUND);
    }
    const reachesStudent = assignmentReaches(studentId);
    const plans = await this.prisma.levelingPlan.findMany({
      where: {
        AND: [
          planScope(user),
          { status: 'published' },
          { assignments: { some: reachesStudent } },
        ],
      },
      select: {
        id: true,
        title: true,
        subject: { select: { id: true, name: true, color: true } },
        assignments: { where: reachesStudent, select: { dueDate: true } },
      },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
    });
    if (plans.length === 0) {
      return { data: [] };
    }
    const states = await this.completion.loadSettled(
      [studentId],
      plans.map((plan) => plan.id),
      'plan',
    );
    return {
      data: plans.map((plan) => {
        const state = stateOf(states, studentId, plan.id);
        return presentStudentPlan({
          plan,
          completedChapters: countCompleted(state),
          totalChapters: state.chapters.length,
          completedAt: state.completedAt,
          // O prazo mais próximo entre as atribuições que alcançam o aluno.
          dueDate: earliest(plan.assignments.map((a) => a.dueDate)),
        });
      }),
    };
  }
}

function countCompleted(state: StudentPlanState): number {
  return state.chapters.filter((chapter) => chapter.completed).length;
}

function earliest(dates: Array<Date | null>): Date | null {
  const present = dates.filter((date): date is Date => date !== null);
  return present.length === 0
    ? null
    : present.reduce((a, b) => (a <= b ? a : b));
}
