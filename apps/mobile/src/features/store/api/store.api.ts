import type { AxiosResponse } from 'axios';
import api from 'src/lib/axios';
import type { ApiList, ApiMyRedemption, ApiRedeemResult, ApiStoreReward, Paginated } from '@nivela/api-contract';

export const listStoreRewards = (signal?: AbortSignal): Promise<AxiosResponse<ApiList<ApiStoreReward>>> =>
  api.get<ApiList<ApiStoreReward>>('/store/rewards', { signal });

export const postRedeem = (rewardId: number): Promise<AxiosResponse<ApiRedeemResult>> =>
  api.post<ApiRedeemResult>(`/store/rewards/${rewardId}/redeem`);

export const listMyRedemptions = (
  params: { page: number; per_page: number },
  signal?: AbortSignal,
): Promise<AxiosResponse<Paginated<ApiMyRedemption>>> =>
  api.get<Paginated<ApiMyRedemption>>('/store/redemptions', { params, signal });
