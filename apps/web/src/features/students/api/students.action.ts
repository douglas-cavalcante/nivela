import type { ApiStudent, ApiStudentSummary, Paginated } from '@nivela/api-contract';
import * as studentsApi from 'src/features/students/api/students.api';
import type { ListStudentsParams } from 'src/features/students/api/students.api';

export const listStudentsAction = async (
  params: ListStudentsParams,
  signal?: AbortSignal,
): Promise<Paginated<ApiStudentSummary>> => (await studentsApi.listStudents(params, signal)).data;

export const getStudentAction = async (id: number, signal?: AbortSignal): Promise<ApiStudent> =>
  (await studentsApi.getStudent(id, signal)).data;
