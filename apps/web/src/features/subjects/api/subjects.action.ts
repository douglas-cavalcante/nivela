import type { ApiSubject } from '@nivela/api-contract';
import * as subjectsApi from 'src/features/subjects/api/subjects.api';
import type { SubjectFormValues } from 'src/features/subjects/schemas/subject.schema';

export const listSubjectsAction = async (signal?: AbortSignal): Promise<ApiSubject[]> =>
  (await subjectsApi.listSubjects(signal)).data.data;

export const createSubjectAction = async (data: SubjectFormValues): Promise<ApiSubject> =>
  (await subjectsApi.createSubject(data)).data;

export const updateSubjectAction = async (id: number, data: SubjectFormValues): Promise<ApiSubject> =>
  (await subjectsApi.updateSubject(id, data)).data;

export const deleteSubjectAction = async (id: number): Promise<void> => {
  await subjectsApi.deleteSubject(id);
};
