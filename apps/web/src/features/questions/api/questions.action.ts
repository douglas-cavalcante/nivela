import type { ApiQuestion, ApiQuestionSummary, Paginated, QuestionPayload } from '@nivela/api-contract';
import * as questionsApi from 'src/features/questions/api/questions.api';
import type { ListQuestionsParams } from 'src/features/questions/api/questions.api';

export const listQuestionsAction = async (
  params: ListQuestionsParams,
  signal?: AbortSignal,
): Promise<Paginated<ApiQuestionSummary>> => (await questionsApi.listQuestions(params, signal)).data;

export const getQuestionAction = async (id: number, signal?: AbortSignal): Promise<ApiQuestion> =>
  (await questionsApi.getQuestion(id, signal)).data;

export const createQuestionAction = async (data: QuestionPayload): Promise<ApiQuestion> =>
  (await questionsApi.createQuestion(data)).data;

export const updateQuestionAction = async (id: number, data: QuestionPayload): Promise<ApiQuestion> =>
  (await questionsApi.updateQuestion(id, data)).data;

/** Devolve a URL pública da imagem gravada. */
export const uploadQuestionImageAction = async (id: number, file: File): Promise<string> =>
  (await questionsApi.uploadQuestionImage(id, file)).data.image_url;

export const deleteQuestionImageAction = async (id: number): Promise<void> => {
  await questionsApi.deleteQuestionImage(id);
};
