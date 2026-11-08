import type { AxiosResponse } from 'axios';
import type { ApiSubject } from '@nivela/api-contract';
import api from 'src/lib/axios';
import type { SubjectFormValues } from 'src/features/subjects/schemas/subject.schema';

export const listSubjects = (signal?: AbortSignal): Promise<AxiosResponse<{ data: ApiSubject[] }>> =>
  api.get<{ data: ApiSubject[] }>('/subjects', { signal });

export const createSubject = (data: SubjectFormValues): Promise<AxiosResponse<ApiSubject>> =>
  api.post<ApiSubject>('/subjects', data);

export const updateSubject = (id: number, data: SubjectFormValues): Promise<AxiosResponse<ApiSubject>> =>
  api.put<ApiSubject>(`/subjects/${id}`, data);

export const deleteSubject = (id: number): Promise<AxiosResponse<void>> => api.delete<void>(`/subjects/${id}`);
