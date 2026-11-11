import type {
  ApiMyPlan,
  ApiMyPlanSummary,
  SubjectColorKey,
  SubjectIconKey,
} from '@nivela/api-contract';
import {
  percentOf,
  type ResolvedChapter,
} from 'src/modules/leveling-plans/chapter-states';

export interface MyPlanRow {
  id: number;
  title: string;
  description: string | null;
  completionBonus: number;
  subject: { id: number; name: string; color: string; icon: string };
}

export function presentMyPlanSummary(
  plan: MyPlanRow,
  chapters: ResolvedChapter[],
  dueDate: Date | null,
  completed: boolean,
): ApiMyPlanSummary {
  const done = chapters.filter((chapter) => chapter.completed).length;
  return {
    id: plan.id,
    title: plan.title,
    subject: {
      id: plan.subject.id,
      name: plan.subject.name,
      color: plan.subject.color as SubjectColorKey,
      icon: plan.subject.icon as SubjectIconKey,
    },
    progress: {
      completed_chapters: done,
      total_chapters: chapters.length,
      percent: percentOf(done, chapters.length),
    },
    due_date: dueDate ? dueDate.toISOString().slice(0, 10) : null,
    completed,
    completion_bonus: plan.completionBonus,
  } satisfies ApiMyPlanSummary;
}

export function presentMyPlan(
  plan: MyPlanRow,
  chapters: ResolvedChapter[],
  dueDate: Date | null,
  completed: boolean,
): ApiMyPlan {
  return {
    ...presentMyPlanSummary(plan, chapters, dueDate, completed),
    description: plan.description,
    chapters: chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      position: chapter.position,
      state: chapter.state,
      answered: chapter.answered,
      total: chapter.total,
    })),
  } satisfies ApiMyPlan;
}
