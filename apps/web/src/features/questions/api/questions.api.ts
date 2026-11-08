import type { AxiosResponse } from 'axios';
import type { ApiQuestion, ApiQuestionSummary, Difficulty, Paginated, QuestionPayload } from '@nivela/api-contract';
import api from 'src/lib/axios';

export interface ListQuestionsParams {
  page?: number;
  search?: string;
  subject_id?: number;
  category_id?: number;
  difficulty?: Difficulty;
  status?: 'active' | 'inactive';
}

export const listQuestions = (
  params: ListQuestionsParams,
  signal?: AbortSignal,
): Promise<AxiosResponse<Paginated<ApiQuestionSummary>>> =>
  api.get<Paginated<ApiQuestionSummary>>('/questions', { params, signal });

export const getQuestion = (id: number, signal?: AbortSignal): Promise<AxiosResponse<ApiQuestion>> =>
  api.get<ApiQuestion>(`/questions/${id}`, { signal });

export const createQuestion = (data: QuestionPayload): Promise<AxiosResponse<ApiQuestion>> =>
  api.post<ApiQuestion>('/questions', data);

export const updateQuestion = (id: number, data: QuestionPayload): Promise<AxiosResponse<ApiQuestion>> =>
  api.put<ApiQuestion>(`/questions/${id}`, data);

/** Multipart com o arquivo no campo `image` (o navegador define o Content-Type com o boundary). */
export const uploadQuestionImage = (id: number, file: File): Promise<AxiosResponse<{ image_url: string }>> => {
  const body = new FormData();
  body.append('image', file);
  return api.post<{ image_url: string }>(`/questions/${id}/image`, body);
};

export const deleteQuestionImage = (id: number): Promise<AxiosResponse<void>> =>
  api.delete<void>(`/questions/${id}/image`);
