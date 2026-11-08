import type { AxiosResponse } from 'axios';
import api from 'src/lib/axios';
import type { ApiList, ApiMyClassroom } from '@nivela/api-contract';

export const listMyClassrooms = (): Promise<AxiosResponse<ApiList<ApiMyClassroom>>> =>
  api.get<ApiList<ApiMyClassroom>>('/me/classrooms');

export const joinClassroom = (join_code: string): Promise<AxiosResponse<ApiMyClassroom>> =>
  api.post<ApiMyClassroom>('/me/classrooms', { join_code });
