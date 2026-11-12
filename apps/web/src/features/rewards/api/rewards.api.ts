import type { AxiosResponse } from "axios";
import type {
  ApiImageUpload,
  ApiRedemption,
  ApiReward,
  Paginated,
  RedemptionStatus,
  RejectRedemptionPayload,
  RewardPayload,
  UpdateRewardPayload,
} from "@nivela/api-contract";
import api from "src/lib/axios";

export interface ListRewardsParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: "active" | "inactive";
}

export interface ListRedemptionsParams {
  page?: number;
  per_page?: number;
  status?: RedemptionStatus;
  search?: string;
  classroom_id?: number;
}

export const listRewards = (
  params: ListRewardsParams,
  signal?: AbortSignal,
): Promise<AxiosResponse<Paginated<ApiReward>>> =>
  api.get<Paginated<ApiReward>>("/rewards", { params, signal });

export const createReward = (
  data: RewardPayload,
): Promise<AxiosResponse<ApiReward>> => api.post<ApiReward>("/rewards", data);

export const updateReward = (
  id: number,
  data: UpdateRewardPayload,
): Promise<AxiosResponse<ApiReward>> =>
  api.put<ApiReward>(`/rewards/${id}`, data);

export const setRewardStatus = (
  id: number,
  active: boolean,
): Promise<AxiosResponse<ApiReward>> =>
  api.patch<ApiReward>(`/rewards/${id}/status`, { active });

/** Multipart com o arquivo no campo `image` (o navegador define o Content-Type com o boundary). */
export const uploadRewardImage = (
  id: number,
  file: File,
): Promise<AxiosResponse<ApiImageUpload>> => {
  const body = new FormData();
  body.append("image", file);
  return api.post<ApiImageUpload>(`/rewards/${id}/image`, body);
};

export const deleteRewardImage = (id: number): Promise<AxiosResponse<void>> =>
  api.delete<void>(`/rewards/${id}/image`);

export const listRedemptions = (
  params: ListRedemptionsParams,
  signal?: AbortSignal,
): Promise<AxiosResponse<Paginated<ApiRedemption>>> =>
  api.get<Paginated<ApiRedemption>>("/redemptions", { params, signal });

export const deliverRedemption = (
  id: number,
): Promise<AxiosResponse<ApiRedemption>> =>
  api.post<ApiRedemption>(`/redemptions/${id}/deliver`);

export const rejectRedemption = (
  id: number,
  data: RejectRedemptionPayload,
): Promise<AxiosResponse<ApiRedemption>> =>
  api.post<ApiRedemption>(`/redemptions/${id}/reject`, data);
