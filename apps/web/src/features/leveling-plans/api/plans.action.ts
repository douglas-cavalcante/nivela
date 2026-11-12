import type {
  ApiPlan,
  ApiPlanAssignment,
  ApiPlanProgressRow,
  ApiPlanSummary,
  ApiStudentPlanProgress,
  Paginated,
} from '@nivela/api-contract';
import * as plansApi from 'src/features/leveling-plans/api/plans.api';
import type { ListPlansParams } from 'src/features/leveling-plans/api/plans.api';
import type { AssignmentPayload, PlanPayload } from 'src/features/leveling-plans/schemas/plan.schema';

export const listPlansAction = async (
  params: ListPlansParams,
  signal?: AbortSignal,
): Promise<Paginated<ApiPlanSummary>> => (await plansApi.listPlans(params, signal)).data;

export const getPlanAction = async (id: number, signal?: AbortSignal): Promise<ApiPlan> =>
  (await plansApi.getPlan(id, signal)).data;

export const createPlanAction = async (data: PlanPayload): Promise<ApiPlan> => (await plansApi.createPlan(data)).data;

export const updatePlanAction = async (id: number, data: PlanPayload): Promise<ApiPlan> =>
  (await plansApi.updatePlan(id, data)).data;

export const publishPlanAction = async (id: number): Promise<ApiPlan> => (await plansApi.publishPlan(id)).data;

export const addChapterAction = async (id: number, title: string): Promise<ApiPlan> =>
  (await plansApi.addChapter(id, title)).data;

export const renameChapterAction = async (id: number, chapterId: number, title: string): Promise<ApiPlan> =>
  (await plansApi.renameChapter(id, chapterId, title)).data;

export const removeChapterAction = async (id: number, chapterId: number): Promise<ApiPlan> =>
  (await plansApi.removeChapter(id, chapterId)).data;

export const reorderChaptersAction = async (id: number, chapterIds: number[]): Promise<ApiPlan> =>
  (await plansApi.reorderChapters(id, chapterIds)).data;

export const setChapterQuestionsAction = async (
  id: number,
  chapterId: number,
  questionIds: number[],
): Promise<ApiPlan> => (await plansApi.setChapterQuestions(id, chapterId, questionIds)).data;

export const listAssignmentsAction = async (id: number, signal?: AbortSignal): Promise<ApiPlanAssignment[]> =>
  (await plansApi.listAssignments(id, signal)).data.data;

export const createAssignmentAction = async (id: number, data: AssignmentPayload): Promise<ApiPlanAssignment> =>
  (await plansApi.createAssignment(id, data)).data;

export const deleteAssignmentAction = async (id: number, assignmentId: number): Promise<void> => {
  await plansApi.deleteAssignment(id, assignmentId);
};

export const listPlanProgressAction = async (id: number, signal?: AbortSignal): Promise<ApiPlanProgressRow[]> =>
  (await plansApi.listPlanProgress(id, signal)).data.data;

export const listStudentPlansAction = async (
  studentId: number,
  signal?: AbortSignal,
): Promise<ApiStudentPlanProgress[]> => (await plansApi.listStudentPlans(studentId, signal)).data.data;
