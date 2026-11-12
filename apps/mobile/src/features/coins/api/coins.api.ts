import type { AxiosResponse } from 'axios';
import api from 'src/lib/axios';
import type { ApiCoinTransaction, Paginated } from '@nivela/api-contract';

export const listMyCoins = (
  params: { page: number; per_page: number },
  signal?: AbortSignal,
): Promise<AxiosResponse<Paginated<ApiCoinTransaction>>> =>
  api.get<Paginated<ApiCoinTransaction>>('/me/coins', { params, signal });
