import type { AxiosResponse } from 'axios';
import type {
  ApiActivityDay,
  ApiCategoryPerformance,
  ApiCoinTransaction,
  ApiDashboardSummary,
  ApiList,
  ApiQuestionSummary,
  ApiStudentNeedingHelp,
  Paginated,
} from '@nivela/api-contract';
import api from 'src/lib/axios';

export interface ListCoinsParams {
  page?: number;
  per_page?: number;
}

export const getSummary = (signal?: AbortSignal): Promise<AxiosResponse<ApiDashboardSummary>> =>
  api.get<ApiDashboardSummary>('/dashboard/summary', { signal });

export const listActivity = (days: number, signal?: AbortSignal): Promise<AxiosResponse<ApiList<ApiActivityDay>>> =>
  api.get<ApiList<ApiActivityDay>>('/dashboard/activity', { params: { days }, signal });

export const listNeedingHelp = (signal?: AbortSignal): Promise<AxiosResponse<ApiList<ApiStudentNeedingHelp>>> =>
  api.get<ApiList<ApiStudentNeedingHelp>>('/dashboard/needing-help', { signal });

export const listRecentQuestions = (signal?: AbortSignal): Promise<AxiosResponse<ApiList<ApiQuestionSummary>>> =>
  api.get<ApiList<ApiQuestionSummary>>('/dashboard/recent-questions', { signal });

export const listClassroomPerformance = (
  classroomId: number,
  signal?: AbortSignal,
): Promise<AxiosResponse<ApiList<ApiCategoryPerformance>>> =>
  api.get<ApiList<ApiCategoryPerformance>>(`/classrooms/${classroomId}/performance`, { signal });

export const listStudentPerformance = (
  studentId: number,
  signal?: AbortSignal,
): Promise<AxiosResponse<ApiList<ApiCategoryPerformance>>> =>
  api.get<ApiList<ApiCategoryPerformance>>(`/students/${studentId}/performance`, { signal });

export const listStudentCoins = (
  studentId: number,
  params: ListCoinsParams,
  signal?: AbortSignal,
): Promise<AxiosResponse<Paginated<ApiCoinTransaction>>> =>
  api.get<Paginated<ApiCoinTransaction>>(`/students/${studentId}/coins`, { params, signal });
