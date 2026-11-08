import type { AxiosResponse } from 'axios';
import api from 'src/lib/axios';
import type { ApiMyClassroom } from '@nivela/api-contract';

export const listMyClassrooms = (): Promise<AxiosResponse<{ data: ApiMyClassroom[] }>> =>
  api.get<{ data: ApiMyClassroom[] }>('/me/classrooms');

export const joinClassroom = (join_code: string): Promise<AxiosResponse<ApiMyClassroom>> =>
  api.post<ApiMyClassroom>('/me/classrooms', { join_code });
