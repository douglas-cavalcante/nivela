import * as storeApi from 'src/features/store/api/store.api';
import type { ApiMyRedemption, ApiRedeemResult, ApiStoreReward, Paginated } from '@nivela/api-contract';

export const listStoreRewardsAction = async (signal?: AbortSignal): Promise<ApiStoreReward[]> =>
  (await storeApi.listStoreRewards(signal)).data.data;

export const redeemAction = async (rewardId: number): Promise<ApiRedeemResult> =>
  (await storeApi.postRedeem(rewardId)).data;

export const listMyRedemptionsAction = async (
  page: number,
  perPage: number,
  signal?: AbortSignal,
): Promise<Paginated<ApiMyRedemption>> =>
  (await storeApi.listMyRedemptions({ page, per_page: perPage }, signal)).data;
