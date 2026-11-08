import { lazy } from 'react';

// API pública da feature teachers.
export const TeacherList = lazy(() =>
  import('src/features/teachers/pages/TeacherList').then((m) => ({ default: m.TeacherList })),
);
export { listTeachersAction } from 'src/features/teachers/api/teachers.action';
