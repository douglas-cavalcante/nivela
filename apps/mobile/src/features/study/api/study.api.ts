import type { AxiosResponse } from 'axios';
import api from 'src/lib/axios';
import type {
  ApiAnswerPayload,
  ApiAnswerResult,
  ApiList,
  ApiPracticeNext,
  ApiPracticeSubject,
  ApiStudentStats,
} from '@nivela/api-contract';

export const listPracticeSubjects = (signal?: AbortSignal): Promise<AxiosResponse<ApiList<ApiPracticeSubject>>> =>
  api.get<ApiList<ApiPracticeSubject>>('/practice/subjects', { signal });

export const getPracticeNext = (
  params: { subject_id: number; category_id?: number },
  signal?: AbortSignal,
): Promise<AxiosResponse<ApiPracticeNext>> => api.get<ApiPracticeNext>('/practice/next', { params, signal });

export const postAnswer = (payload: ApiAnswerPayload): Promise<AxiosResponse<ApiAnswerResult>> =>
  api.post<ApiAnswerResult>('/answers', payload);

export const getStats = (signal?: AbortSignal): Promise<AxiosResponse<ApiStudentStats>> =>
  api.get<ApiStudentStats>('/me/stats', { signal });
