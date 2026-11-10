import type { Difficulty } from './questions';
import type { SubjectColorKey } from './subjects';

export type PlanStatus = 'draft' | 'published';

export interface ApiPlanSummary {
  id: number;
  title: string;
  status: PlanStatus;
  subject: { id: number; name: string; color: SubjectColorKey };
  chapters_count: number;
  questions_count: number;
  assignments_count: number;
  teacher: { id: number; name: string };
  updated_at: string;
}

export interface ApiPlanChapter {
  id: number;
  title: string;
  position: number;
  questions: Array<{
    id: number;
    statement_excerpt: string;
    difficulty: Difficulty;
    active: boolean;
  }>;
}

export interface ApiPlan extends ApiPlanSummary {
  description: string | null;
  completion_bonus: number;
  chapters: ApiPlanChapter[];
  /** Algum aluno já respondeu questões do plano (trava remoções). */
  has_progress: boolean;
  can_edit: boolean;
}

export interface ApiPlanAssignment {
  id: number;
  target: { type: 'classroom' | 'student'; id: number; name: string };
  due_date: string | null;
  created_at: string;
}

export interface ApiPlanProgressRow {
  student: { id: number; name: string };
  completed_chapters: number;
  total_chapters: number;
  answered: number;
  correct: number;
  completed_at: string | null;
}

export interface ApiStudentPlanProgress {
  plan: {
    id: number;
    title: string;
    subject: { id: number; name: string; color: SubjectColorKey };
  };
  completed_chapters: number;
  total_chapters: number;
  completed_at: string | null;
  due_date: string | null;
}
