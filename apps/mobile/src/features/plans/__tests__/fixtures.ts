import type {
  ApiAnswerResult,
  ApiChapterNext,
  ApiMyPlan,
  ApiMyPlanSummary,
  ApiStudentQuestion,
  ApiStudentStats,
} from '@nivela/api-contract';

export const question: ApiStudentQuestion = {
  id: 5,
  statement: 'Quanto é dois mais dois?',
  image_url: null,
  difficulty: 'easy',
  subject: { id: 1, name: 'Matemática', color: 'teal' },
  category: { id: 10, name: 'Álgebra' },
  options: [
    { letter: 'A', text: 'Três' },
    { letter: 'B', text: 'Quatro' },
    { letter: 'C', text: 'Cinco' },
    { letter: 'D', text: 'Seis' },
    { letter: 'E', text: 'Sete' },
  ],
  attempts_left: 2,
};

export const stats: ApiStudentStats = { coins_balance: 120, current_streak: 3, best_streak: 5 };

export const correctResult: ApiAnswerResult = {
  is_correct: true,
  attempt_number: 1,
  finished: true,
  coins_awarded: 10,
  coins_balance: 130,
  correct_letter: 'B',
  explanation: 'Dois mais dois são quatro.',
  streak: { current: 4, best: 5, bonus_awarded: 0 },
};

export const firstMiss: ApiAnswerResult = {
  ...correctResult,
  is_correct: false,
  finished: false,
  coins_awarded: 0,
  coins_balance: 120,
  correct_letter: null,
  explanation: null,
  streak: { current: 3, best: 5, bonus_awarded: 0 },
};

export const planSummary: ApiMyPlanSummary = {
  id: 7,
  title: 'Frações do zero',
  subject: { id: 1, name: 'Matemática', color: 'teal', icon: 'calculator' },
  progress: { completed_chapters: 3, total_chapters: 5, percent: 60 },
  due_date: '2026-11-20',
  completed: false,
  completion_bonus: 50,
};

export const noDuePlan: ApiMyPlanSummary = {
  ...planSummary,
  id: 8,
  title: 'Verbos no passado',
  subject: { id: 2, name: 'Português', color: 'coral', icon: 'book' },
  progress: { completed_chapters: 0, total_chapters: 2, percent: 0 },
  due_date: null,
};

export const plan: ApiMyPlan = {
  ...planSummary,
  description: null,
  progress: { completed_chapters: 1, total_chapters: 3, percent: 33 },
  chapters: [
    { id: 21, title: 'O que é uma fração', position: 1, state: 'completed', answered: 4, total: 4 },
    { id: 22, title: 'Frações equivalentes', position: 2, state: 'available', answered: 1, total: 5 },
    { id: 23, title: 'Somando frações', position: 3, state: 'locked', answered: 0, total: 3 },
  ],
};

export const nextOf = (q: ApiStudentQuestion | null, remaining = 3): ApiChapterNext => ({ question: q, remaining });

export const chapterNext = (remaining = 4): ApiChapterNext => ({ question, remaining });
