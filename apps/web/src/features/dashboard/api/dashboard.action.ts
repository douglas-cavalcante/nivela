import type {
  ApiActivityDay,
  ApiCategoryPerformance,
  ApiCoinTransaction,
  ApiDashboardSummary,
  ApiQuestionSummary,
  ApiStudentNeedingHelp,
  Paginated,
} from '@nivela/api-contract';
import * as dashboardApi from 'src/features/dashboard/api/dashboard.api';
import type { ListCoinsParams } from 'src/features/dashboard/api/dashboard.api';

export const getSummaryAction = async (signal?: AbortSignal): Promise<ApiDashboardSummary> =>
  (await dashboardApi.getSummary(signal)).data;

export const listActivityAction = async (days: number, signal?: AbortSignal): Promise<ApiActivityDay[]> =>
  (await dashboardApi.listActivity(days, signal)).data.data;

export const listNeedingHelpAction = async (signal?: AbortSignal): Promise<ApiStudentNeedingHelp[]> =>
  (await dashboardApi.listNeedingHelp(signal)).data.data;

export const listRecentQuestionsAction = async (signal?: AbortSignal): Promise<ApiQuestionSummary[]> =>
  (await dashboardApi.listRecentQuestions(signal)).data.data;

export const listClassroomPerformanceAction = async (
  classroomId: number,
  signal?: AbortSignal,
): Promise<ApiCategoryPerformance[]> => (await dashboardApi.listClassroomPerformance(classroomId, signal)).data.data;

export const listStudentPerformanceAction = async (
  studentId: number,
  signal?: AbortSignal,
): Promise<ApiCategoryPerformance[]> => (await dashboardApi.listStudentPerformance(studentId, signal)).data.data;

export const listStudentCoinsAction = async (
  studentId: number,
  params: ListCoinsParams,
  signal?: AbortSignal,
): Promise<Paginated<ApiCoinTransaction>> => (await dashboardApi.listStudentCoins(studentId, params, signal)).data;
