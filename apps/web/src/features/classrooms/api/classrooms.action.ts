import type { ApiClassroom, ApiClassroomSummary, ApiStudent, Paginated } from '@nivela/api-contract';
import * as classroomsApi from 'src/features/classrooms/api/classrooms.api';
import type { ListClassroomsParams } from 'src/features/classrooms/api/classrooms.api';
import type { AddStudentValues, ClassroomPayload } from 'src/features/classrooms/schemas/classroom.schema';

export const listClassroomsAction = async (
  params: ListClassroomsParams,
  signal?: AbortSignal,
): Promise<Paginated<ApiClassroomSummary>> => (await classroomsApi.listClassrooms(params, signal)).data;

export const getClassroomAction = async (id: number, signal?: AbortSignal): Promise<ApiClassroom> =>
  (await classroomsApi.getClassroom(id, signal)).data;

export const createClassroomAction = async (data: ClassroomPayload): Promise<ApiClassroom> =>
  (await classroomsApi.createClassroom(data)).data;

export const updateClassroomAction = async (id: number, data: ClassroomPayload): Promise<ApiClassroom> =>
  (await classroomsApi.updateClassroom(id, data)).data;

export const regenerateJoinCodeAction = async (id: number): Promise<string> =>
  (await classroomsApi.regenerateJoinCode(id)).data.join_code;

export const addClassroomStudentAction = async (id: number, data: AddStudentValues): Promise<ApiStudent> =>
  (await classroomsApi.addClassroomStudent(id, data)).data;

export const removeClassroomStudentAction = async (id: number, studentId: number): Promise<void> => {
  await classroomsApi.removeClassroomStudent(id, studentId);
};
