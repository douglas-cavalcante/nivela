import type { ApiChapterNext, ApiMyPlan, ApiMyPlanSummary } from '@nivela/api-contract';
import { question } from 'src/test/studyFixtures';

export const planSummary: ApiMyPlanSummary = {
  id: 7,
  title: 'Frações do zero',
  subject: { id: 1, name: 'Matemática', color: 'teal', icon: 'calculator' },
  progress: { completed_chapters: 3, total_chapters: 5, percent: 60, available_questions: 12 },
  due_date: '2026-11-20',
  completed: false,
  completion_bonus: 50,
};

export const noDuePlan: ApiMyPlanSummary = {
  ...planSummary,
  id: 8,
  title: 'Verbos no passado',
  subject: { id: 2, name: 'Português', color: 'coral', icon: 'book' },
  progress: { completed_chapters: 0, total_chapters: 2, percent: 0, available_questions: 6 },
  due_date: null,
};

export const donePlan: ApiMyPlanSummary = {
  ...planSummary,
  id: 9,
  title: 'Geometria básica',
  progress: { completed_chapters: 4, total_chapters: 4, percent: 100, available_questions: 9 },
  due_date: null,
  completed: true,
};

export const emptyPlan: ApiMyPlanSummary = {
  ...planSummary,
  id: 10,
  title: 'Revisão de álgebra',
  progress: { completed_chapters: 1, total_chapters: 2, percent: 50, available_questions: 0 },
  due_date: null,
  completed: false,
};

/** Plano concluído cujas questões foram desativadas depois. */
export const doneEmptyPlan: ApiMyPlanSummary = {
  ...emptyPlan,
  id: 11,
  title: 'Revisão de geometria',
  progress: { completed_chapters: 2, total_chapters: 2, percent: 100, available_questions: 0 },
  completed: true,
};

export const plan: ApiMyPlan = {
  ...planSummary,
  description: null,
  progress: { completed_chapters: 1, total_chapters: 3, percent: 33, available_questions: 12 },
  chapters: [
    { id: 21, title: 'O que é uma fração', position: 1, state: 'completed', answered: 4, total: 4 },
    { id: 22, title: 'Frações equivalentes', position: 2, state: 'available', answered: 1, total: 5 },
    { id: 23, title: 'Somando frações', position: 3, state: 'locked', answered: 0, total: 3 },
  ],
};

export const chapterNext = (remaining = 4): ApiChapterNext => ({ question, remaining });
