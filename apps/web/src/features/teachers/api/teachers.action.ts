import type { ApiTeacher, Paginated } from '@nivela/api-contract';
import * as teachersApi from 'src/features/teachers/api/teachers.api';
import type { ListTeachersParams } from 'src/features/teachers/api/teachers.api';
import type {
  CreateTeacherValues,
  TeacherPasswordValues,
  UpdateTeacherValues,
} from 'src/features/teachers/schemas/teacher.schema';

export const listTeachersAction = async (
  params: ListTeachersParams,
  signal?: AbortSignal,
): Promise<Paginated<ApiTeacher>> => (await teachersApi.listTeachers(params, signal)).data;

export const createTeacherAction = async (data: CreateTeacherValues): Promise<ApiTeacher> =>
  (await teachersApi.createTeacher(data)).data;

export const updateTeacherAction = async (id: number, data: UpdateTeacherValues): Promise<ApiTeacher> =>
  (await teachersApi.updateTeacher(id, data)).data;

export const setTeacherStatusAction = async (id: number, active: boolean): Promise<ApiTeacher> =>
  (await teachersApi.setTeacherStatus(id, active)).data;

export const resetTeacherPasswordAction = async (id: number, data: TeacherPasswordValues): Promise<void> => {
  await teachersApi.resetTeacherPassword(id, data);
};
