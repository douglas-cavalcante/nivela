import { lazy } from 'react';

// API pública da feature questions: as páginas que as rotas carregam sob demanda.
export const QuestionList = lazy(() =>
  import('src/features/questions/pages/QuestionList').then((m) => ({ default: m.QuestionList })),
);
export const QuestionForm = lazy(() =>
  import('src/features/questions/pages/QuestionForm').then((m) => ({ default: m.QuestionForm })),
);
