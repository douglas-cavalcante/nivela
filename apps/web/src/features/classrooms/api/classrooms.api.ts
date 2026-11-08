import type { AxiosResponse } from 'axios';
import type { ApiClassroom, ApiClassroomSummary, ApiStudent, Paginated } from '@nivela/api-contract';
import api from 'src/lib/axios';
import type { AddStudentValues, ClassroomPayload } from 'src/features/classrooms/schemas/classroom.schema';

export interface ListClassroomsParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: 'active' | 'inactive';
}

export const listClassrooms = (
  params: ListClassroomsParams,
  signal?: AbortSignal,
): Promise<AxiosResponse<Paginated<ApiClassroomSummary>>> =>
  api.get<Paginated<ApiClassroomSummary>>('/classrooms', { params, signal });

export const getClassroom = (id: number, signal?: AbortSignal): Promise<AxiosResponse<ApiClassroom>> =>
  api.get<ApiClassroom>(`/classrooms/${id}`, { signal });

export const createClassroom = (data: ClassroomPayload): Promise<AxiosResponse<ApiClassroom>> =>
  api.post<ApiClassroom>('/classrooms', data);

export const updateClassroom = (id: number, data: ClassroomPayload): Promise<AxiosResponse<ApiClassroom>> =>
  api.put<ApiClassroom>(`/classrooms/${id}`, data);

export const regenerateJoinCode = (id: number): Promise<AxiosResponse<{ join_code: string }>> =>
  api.post<{ join_code: string }>(`/classrooms/${id}/join-code`);

export const addClassroomStudent = (id: number, data: AddStudentValues): Promise<AxiosResponse<ApiStudent>> =>
  api.post<ApiStudent>(`/classrooms/${id}/students`, data);

export const removeClassroomStudent = (id: number, studentId: number): Promise<AxiosResponse<void>> =>
  api.delete<void>(`/classrooms/${id}/students/${studentId}`);
