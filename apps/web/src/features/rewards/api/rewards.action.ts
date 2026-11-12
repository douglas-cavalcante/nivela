import type {
  ApiRedemption,
  ApiReward,
  Paginated,
  RejectRedemptionPayload,
  RewardPayload,
} from '@nivela/api-contract';
import * as rewardsApi from 'src/features/rewards/api/rewards.api';
import type { ListRedemptionsParams, ListRewardsParams } from 'src/features/rewards/api/rewards.api';

export const listRewardsAction = async (
  params: ListRewardsParams,
  signal?: AbortSignal,
): Promise<Paginated<ApiReward>> => (await rewardsApi.listRewards(params, signal)).data;

export const createRewardAction = async (data: RewardPayload): Promise<ApiReward> =>
  (await rewardsApi.createReward(data)).data;

export const updateRewardAction = async (id: number, data: RewardPayload): Promise<ApiReward> =>
  (await rewardsApi.updateReward(id, data)).data;

export const setRewardStatusAction = async (id: number, active: boolean): Promise<ApiReward> =>
  (await rewardsApi.setRewardStatus(id, active)).data;

/** Devolve o `image_url` gravado. */
export const uploadRewardImageAction = async (id: number, file: File): Promise<string> =>
  (await rewardsApi.uploadRewardImage(id, file)).data.image_url;

export const deleteRewardImageAction = async (id: number): Promise<void> => {
  await rewardsApi.deleteRewardImage(id);
};

export const listRedemptionsAction = async (
  params: ListRedemptionsParams,
  signal?: AbortSignal,
): Promise<Paginated<ApiRedemption>> => (await rewardsApi.listRedemptions(params, signal)).data;

export const deliverRedemptionAction = async (id: number): Promise<ApiRedemption> =>
  (await rewardsApi.deliverRedemption(id)).data;

export const rejectRedemptionAction = async (id: number, data: RejectRedemptionPayload): Promise<ApiRedemption> =>
  (await rewardsApi.rejectRedemption(id, data)).data;
