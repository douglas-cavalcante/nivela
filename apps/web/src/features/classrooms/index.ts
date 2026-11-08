import { lazy } from 'react';

// API pública da feature classrooms.
export { listClassroomsAction } from 'src/features/classrooms/api/classrooms.action';
export const ClassroomList = lazy(() =>
  import('src/features/classrooms/pages/ClassroomList').then((m) => ({ default: m.ClassroomList })),
);
export const ClassroomDetail = lazy(() =>
  import('src/features/classrooms/pages/ClassroomDetail').then((m) => ({ default: m.ClassroomDetail })),
);
