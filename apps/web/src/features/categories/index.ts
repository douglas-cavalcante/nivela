import { lazy } from 'react';

// API pública da feature categories.
export const CategoryList = lazy(() =>
  import('src/features/categories/pages/CategoryList').then((m) => ({ default: m.CategoryList })),
);
