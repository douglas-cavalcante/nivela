import type { AxiosResponse } from 'axios';
import type { ApiTeacher, Paginated } from '@nivela/api-contract';
import api from 'src/lib/axios';
import type {
  CreateTeacherValues,
  TeacherPasswordValues,
  UpdateTeacherValues,
} from 'src/features/teachers/schemas/teacher.schema';

export interface ListTeachersParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: 'active' | 'inactive';
}

export const listTeachers = (
  params: ListTeachersParams,
  signal?: AbortSignal,
): Promise<AxiosResponse<Paginated<ApiTeacher>>> => api.get<Paginated<ApiTeacher>>('/teachers', { params, signal });

export const createTeacher = (data: CreateTeacherValues): Promise<AxiosResponse<ApiTeacher>> =>
  api.post<ApiTeacher>('/teachers', data);

export const updateTeacher = (id: number, data: UpdateTeacherValues): Promise<AxiosResponse<ApiTeacher>> =>
  api.put<ApiTeacher>(`/teachers/${id}`, data);

export const setTeacherStatus = (id: number, active: boolean): Promise<AxiosResponse<ApiTeacher>> =>
  api.patch<ApiTeacher>(`/teachers/${id}/status`, { active });

export const resetTeacherPassword = (id: number, data: TeacherPasswordValues): Promise<AxiosResponse<void>> =>
  api.put<void>(`/teachers/${id}/password`, data);
