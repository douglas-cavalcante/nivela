import * as studyApi from 'src/features/study/api/study.api';
import type {
  ApiAnswerPayload,
  ApiAnswerResult,
  ApiPracticeNext,
  ApiPracticeSubject,
  ApiStudentStats,
} from '@nivela/api-contract';

export const listPracticeSubjectsAction = async (signal?: AbortSignal): Promise<ApiPracticeSubject[]> =>
  (await studyApi.listPracticeSubjects(signal)).data.data;

export const getPracticeNextAction = async (
  subjectId: number,
  categoryId?: number,
  signal?: AbortSignal,
): Promise<ApiPracticeNext> =>
  (await studyApi.getPracticeNext({ subject_id: subjectId, category_id: categoryId }, signal)).data;

export const answerAction = async (payload: ApiAnswerPayload): Promise<ApiAnswerResult> =>
  (await studyApi.postAnswer(payload)).data;

export const getStatsAction = async (signal?: AbortSignal): Promise<ApiStudentStats> =>
  (await studyApi.getStats(signal)).data;
