import type { Prisma } from 'src/generated/prisma/client';

/** Atribuições que alcançam o aluno: direta ou pela turma em que está matriculado. */
export function assignmentReaches(
  studentId: number,
): Prisma.PlanAssignmentWhereInput {
  return {
    OR: [{ studentId }, { classroom: { students: { some: { studentId } } } }],
  };
}

/**
 * Visibilidade de planos para o aluno: só planos publicados atribuídos a ele
 * ou a uma turma em que está matriculado. Único filtro usado em toda rota do
 * aluno que lê plano, capítulo ou questão de capítulo.
 */
export function studentPlanScope(
  studentId: number,
): Prisma.LevelingPlanWhereInput {
  return {
    status: 'published',
    assignments: { some: assignmentReaches(studentId) },
  };
}
