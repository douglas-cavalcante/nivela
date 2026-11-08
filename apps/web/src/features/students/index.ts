import { lazy } from 'react';

// API pública da feature students.
export const StudentList = lazy(() =>
  import('src/features/students/pages/StudentList').then((m) => ({ default: m.StudentList })),
);
export const StudentDetail = lazy(() =>
  import('src/features/students/pages/StudentDetail').then((m) => ({ default: m.StudentDetail })),
);
