import { lazy } from 'react';

// API pública da feature leveling-plans.
export const PlanList = lazy(() =>
  import('src/features/leveling-plans/pages/PlanList').then((m) => ({ default: m.PlanList })),
);
