import { lazy } from 'react';

// API pública da feature subjects: o que o resto do app pode usar.
export { SubjectBadge } from 'src/features/subjects/components/SubjectBadge';
export { SubjectIcon } from 'src/features/subjects/components/SubjectIcon';
export { listSubjectsAction } from 'src/features/subjects/api/subjects.action';
export const SubjectList = lazy(() =>
  import('src/features/subjects/pages/SubjectList').then((m) => ({ default: m.SubjectList })),
);
