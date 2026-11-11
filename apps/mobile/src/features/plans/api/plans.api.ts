import type { AxiosResponse } from 'axios';
import api from 'src/lib/axios';
import type { ApiChapterNext, ApiList, ApiMyPlan, ApiMyPlanSummary } from '@nivela/api-contract';

export const listMyPlans = (signal?: AbortSignal): Promise<AxiosResponse<ApiList<ApiMyPlanSummary>>> =>
  api.get<ApiList<ApiMyPlanSummary>>('/me/plans', { signal });

export const getMyPlan = (planId: number, signal?: AbortSignal): Promise<AxiosResponse<ApiMyPlan>> =>
  api.get<ApiMyPlan>(`/me/plans/${planId}`, { signal });

export const getChapterNext = (
  planId: number,
  chapterId: number,
  signal?: AbortSignal,
): Promise<AxiosResponse<ApiChapterNext>> =>
  api.get<ApiChapterNext>(`/me/plans/${planId}/chapters/${chapterId}/next`, { signal });
