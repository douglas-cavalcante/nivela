import type { AxiosResponse } from 'axios';
import type { ApiCategory } from '@nivela/api-contract';
import api from 'src/lib/axios';

export const listCategories = (
  params: { subject_id?: number },
  signal?: AbortSignal,
): Promise<AxiosResponse<{ data: ApiCategory[] }>> => api.get<{ data: ApiCategory[] }>('/categories', { params, signal });

export const createCategory = (data: { name: string; subject_id: number }): Promise<AxiosResponse<ApiCategory>> =>
  api.post<ApiCategory>('/categories', data);

export const updateCategory = (id: number, data: { name: string }): Promise<AxiosResponse<ApiCategory>> =>
  api.put<ApiCategory>(`/categories/${id}`, data);

export const deleteCategory = (id: number): Promise<AxiosResponse<void>> => api.delete<void>(`/categories/${id}`);
