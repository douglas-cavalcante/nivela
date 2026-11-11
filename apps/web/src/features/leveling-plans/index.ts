import { lazy } from 'react';

// API pública da feature leveling-plans.
export { StudentPlans } from 'src/features/leveling-plans/components/StudentPlans';
export const PlanList = lazy(() =>
  import('src/features/leveling-plans/pages/PlanList').then((m) => ({ default: m.PlanList })),
);
export const PlanEditor = lazy(() =>
  import('src/features/leveling-plans/pages/PlanEditor').then((m) => ({ default: m.PlanEditor })),
);
