import { lazy } from 'react';

// API pública da feature rewards: a página que a rota carrega sob demanda.
export const RewardsPage = lazy(() =>
  import('src/features/rewards/pages/RewardsPage').then((m) => ({ default: m.RewardsPage })),
);
