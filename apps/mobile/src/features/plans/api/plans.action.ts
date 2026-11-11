import * as plansApi from 'src/features/plans/api/plans.api';
import type { ApiChapterNext, ApiMyPlan, ApiMyPlanSummary } from '@nivela/api-contract';

export const listMyPlansAction = async (signal?: AbortSignal): Promise<ApiMyPlanSummary[]> =>
  (await plansApi.listMyPlans(signal)).data.data;

export const getMyPlanAction = async (planId: number, signal?: AbortSignal): Promise<ApiMyPlan> =>
  (await plansApi.getMyPlan(planId, signal)).data;

export const getChapterNextAction = async (
  planId: number,
  chapterId: number,
  signal?: AbortSignal,
): Promise<ApiChapterNext> => (await plansApi.getChapterNext(planId, chapterId, signal)).data;
