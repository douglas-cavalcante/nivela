import type { AxiosResponse } from 'axios';
import type {
  ApiList,
  ApiPlan,
  ApiPlanAssignment,
  ApiPlanProgressRow,
  ApiPlanSummary,
  ApiStudentPlanProgress,
  Paginated,
} from '@nivela/api-contract';
import type { AssignmentPayload, PlanPayload } from 'src/features/leveling-plans/schemas/plan.schema';
import api from 'src/lib/axios';

export interface ListPlansParams {
  page?: number;
  search?: string;
  status?: 'draft' | 'published';
  subject_id?: number;
}

export const listPlans = (
  params: ListPlansParams,
  signal?: AbortSignal,
): Promise<AxiosResponse<Paginated<ApiPlanSummary>>> => api.get<Paginated<ApiPlanSummary>>('/plans', { params, signal });

export const getPlan = (id: number, signal?: AbortSignal): Promise<AxiosResponse<ApiPlan>> =>
  api.get<ApiPlan>(`/plans/${id}`, { signal });

export const createPlan = (data: PlanPayload): Promise<AxiosResponse<ApiPlan>> => api.post<ApiPlan>('/plans', data);

export const updatePlan = (id: number, data: PlanPayload): Promise<AxiosResponse<ApiPlan>> =>
  api.put<ApiPlan>(`/plans/${id}`, data);

export const publishPlan = (id: number): Promise<AxiosResponse<ApiPlan>> => api.post<ApiPlan>(`/plans/${id}/publish`);

export const addChapter = (id: number, title: string): Promise<AxiosResponse<ApiPlan>> =>
  api.post<ApiPlan>(`/plans/${id}/chapters`, { title });

export const renameChapter = (id: number, chapterId: number, title: string): Promise<AxiosResponse<ApiPlan>> =>
  api.put<ApiPlan>(`/plans/${id}/chapters/${chapterId}`, { title });

export const removeChapter = (id: number, chapterId: number): Promise<AxiosResponse<ApiPlan>> =>
  api.delete<ApiPlan>(`/plans/${id}/chapters/${chapterId}`);

export const reorderChapters = (id: number, chapterIds: number[]): Promise<AxiosResponse<ApiPlan>> =>
  api.put<ApiPlan>(`/plans/${id}/chapters/order`, { chapter_ids: chapterIds });

export const setChapterQuestions = (
  id: number,
  chapterId: number,
  questionIds: number[],
): Promise<AxiosResponse<ApiPlan>> =>
  api.put<ApiPlan>(`/plans/${id}/chapters/${chapterId}/questions`, { question_ids: questionIds });

export const listAssignments = (
  id: number,
  signal?: AbortSignal,
): Promise<AxiosResponse<ApiList<ApiPlanAssignment>>> =>
  api.get<ApiList<ApiPlanAssignment>>(`/plans/${id}/assignments`, { signal });

export const createAssignment = (id: number, data: AssignmentPayload): Promise<AxiosResponse<ApiPlanAssignment>> =>
  api.post<ApiPlanAssignment>(`/plans/${id}/assignments`, data);

export const deleteAssignment = (id: number, assignmentId: number): Promise<AxiosResponse<void>> =>
  api.delete<void>(`/plans/${id}/assignments/${assignmentId}`);

export const listPlanProgress = (
  id: number,
  signal?: AbortSignal,
): Promise<AxiosResponse<ApiList<ApiPlanProgressRow>>> =>
  api.get<ApiList<ApiPlanProgressRow>>(`/plans/${id}/progress`, { signal });

export const listStudentPlans = (
  studentId: number,
  signal?: AbortSignal,
): Promise<AxiosResponse<ApiList<ApiStudentPlanProgress>>> =>
  api.get<ApiList<ApiStudentPlanProgress>>(`/students/${studentId}/plans`, { signal });
