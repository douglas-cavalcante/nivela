import type { AxiosResponse } from 'axios';
import type { ApiStudent, ApiStudentSummary, Paginated } from '@nivela/api-contract';
import api from 'src/lib/axios';

export interface ListStudentsParams {
  page?: number;
  search?: string;
  classroom_id?: number;
}

export const listStudents = (
  params: ListStudentsParams,
  signal?: AbortSignal,
): Promise<AxiosResponse<Paginated<ApiStudentSummary>>> =>
  api.get<Paginated<ApiStudentSummary>>('/students', { params, signal });

export const getStudent = (id: number, signal?: AbortSignal): Promise<AxiosResponse<ApiStudent>> =>
  api.get<ApiStudent>(`/students/${id}`, { signal });
