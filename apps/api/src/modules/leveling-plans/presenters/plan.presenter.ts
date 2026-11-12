import type {
  ApiPlan,
  ApiPlanAssignment,
  ApiPlanProgressRow,
  ApiPlanSummary,
  ApiStudentPlanProgress,
  Difficulty,
  PlanStatus,
  SubjectColorKey,
} from '@nivela/api-contract';
import { statementExcerpt } from 'src/shared/text/statement-excerpt';

interface SubjectRow {
  id: number;
  name: string;
  color: string;
}

export interface PlanSummaryRow {
  id: number;
  title: string;
  status: string;
  updatedAt: Date;
  subject: SubjectRow;
  teacher: { id: number; name: string };
  // Contagens de capítulos, de atribuições e de questões por capítulo.
  _count: { chapters: number; assignments: number };
  chapters: Array<{ _count: { questions: number } }>;
}

export interface PlanDetailRow extends Omit<PlanSummaryRow, 'chapters'> {
  description: string | null;
  completionBonus: number;
  chapters: Array<{
    id: number;
    title: string;
    position: number;
    _count: { questions: number };
    questions: Array<{
      question: {
        id: number;
        statement: string;
        difficulty: string;
        active: boolean;
      };
    }>;
  }>;
}

const presentSubject = (subject: SubjectRow) => ({
  id: subject.id,
  name: subject.name,
  color: subject.color as SubjectColorKey,
});

export function presentPlanSummary(plan: PlanSummaryRow): ApiPlanSummary {
  return {
    id: plan.id,
    title: plan.title,
    status: plan.status as PlanStatus,
    subject: presentSubject(plan.subject),
    chapters_count: plan._count.chapters,
    questions_count: plan.chapters.reduce(
      (total, chapter) => total + chapter._count.questions,
      0,
    ),
    assignments_count: plan._count.assignments,
    teacher: { id: plan.teacher.id, name: plan.teacher.name },
    updated_at: plan.updatedAt.toISOString(),
  } satisfies ApiPlanSummary;
}

export function presentPlan(
  plan: PlanDetailRow,
  hasProgress: boolean,
): ApiPlan {
  return {
    ...presentPlanSummary(plan),
    description: plan.description,
    completion_bonus: plan.completionBonus,
    chapters: plan.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      position: chapter.position,
      questions: chapter.questions.map(({ question }) => ({
        id: question.id,
        statement_excerpt: statementExcerpt(question.statement),
        difficulty: question.difficulty as Difficulty,
        active: question.active,
      })),
    })),
    has_progress: hasProgress,
    // O escopo (planScope) só deixa passar quem pode gerenciar o plano.
    can_edit: true,
  } satisfies ApiPlan;
}

export function presentAssignment(row: {
  id: number;
  dueDate: Date | null;
  createdAt: Date;
  classroom: { id: number; name: string } | null;
  student: { id: number; name: string } | null;
}): ApiPlanAssignment {
  const target = row.classroom
    ? {
        type: 'classroom' as const,
        id: row.classroom.id,
        name: row.classroom.name,
      }
    : {
        type: 'student' as const,
        id: (row.student as { id: number }).id,
        name: (row.student as { name: string }).name,
      };
  return {
    id: row.id,
    target,
    due_date: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    created_at: row.createdAt.toISOString(),
  } satisfies ApiPlanAssignment;
}

export function presentProgressRow(row: {
  student: { id: number; name: string };
  completedChapters: number;
  totalChapters: number;
  answered: number;
  correct: number;
  completedAt: Date | null;
}): ApiPlanProgressRow {
  return {
    student: { id: row.student.id, name: row.student.name },
    completed_chapters: row.completedChapters,
    total_chapters: row.totalChapters,
    answered: row.answered,
    correct: row.correct,
    completed_at: row.completedAt ? row.completedAt.toISOString() : null,
  } satisfies ApiPlanProgressRow;
}

export function presentStudentPlan(row: {
  plan: { id: number; title: string; subject: SubjectRow };
  completedChapters: number;
  totalChapters: number;
  completedAt: Date | null;
  dueDate: Date | null;
}): ApiStudentPlanProgress {
  return {
    plan: {
      id: row.plan.id,
      title: row.plan.title,
      subject: presentSubject(row.plan.subject),
    },
    completed_chapters: row.completedChapters,
    total_chapters: row.totalChapters,
    completed_at: row.completedAt ? row.completedAt.toISOString() : null,
    due_date: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
  } satisfies ApiStudentPlanProgress;
}
