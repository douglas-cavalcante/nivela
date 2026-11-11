import type { Difficulty } from './questions';
import type { ApiStudentQuestion } from './study';
import type { SubjectColorKey, SubjectIconKey } from './subjects';

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

export type ChapterState = 'locked' | 'available' | 'completed';

/** Plano do aluno (lista de `GET /me/plans`). */
export interface ApiMyPlanSummary {
  id: number;
  title: string;
  subject: {
    id: number;
    name: string;
    color: SubjectColorKey;
    icon: SubjectIconKey;
  };
  progress: {
    completed_chapters: number;
    total_chapters: number;
    /** Inteiro de 0 a 100 (0 quando o plano não tem capítulos). */
    percent: number;
  };
  /** O menor prazo entre as atribuições que alcançam o aluno. */
  due_date: string | null;
  completed: boolean;
  completion_bonus: number;
}

export interface ApiMyPlan extends ApiMyPlanSummary {
  description: string | null;
  chapters: Array<{
    id: number;
    title: string;
    position: number;
    state: ChapterState;
    /** Questões ativas já terminadas pelo aluno neste capítulo. */
    answered: number;
    /** Questões ativas do capítulo. */
    total: number;
  }>;
}

/** Resposta de `GET /me/plans/:id/chapters/:chapterId/next`. */
export interface ApiChapterNext {
  question: ApiStudentQuestion | null;
  /** Questões ativas ainda não terminadas no capítulo, contando a atual. */
  remaining: number;
}
