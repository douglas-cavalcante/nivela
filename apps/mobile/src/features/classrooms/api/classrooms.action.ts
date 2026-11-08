import * as classroomsApi from 'src/features/classrooms/api/classrooms.api';
import type { ApiMyClassroom } from '@nivela/api-contract';

export const listMyClassroomsAction = async (): Promise<ApiMyClassroom[]> =>
  (await classroomsApi.listMyClassrooms()).data.data;

export const joinClassroomAction = async (joinCode: string): Promise<ApiMyClassroom> =>
  (await classroomsApi.joinClassroom(joinCode)).data;
