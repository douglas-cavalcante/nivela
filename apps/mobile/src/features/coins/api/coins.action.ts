import * as coinsApi from 'src/features/coins/api/coins.api';
import type { ApiCoinTransaction, Paginated } from '@nivela/api-contract';

export const listMyCoinsAction = async (
  page: number,
  perPage: number,
  signal?: AbortSignal,
): Promise<Paginated<ApiCoinTransaction>> => (await coinsApi.listMyCoins({ page, per_page: perPage }, signal)).data;
