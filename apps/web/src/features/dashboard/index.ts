import { lazy } from 'react';

// API pública da feature dashboard.
export const Home = lazy(() => import('src/features/dashboard/pages/Home').then((m) => ({ default: m.Home })));
export { CategoryPerformanceChart } from 'src/features/dashboard/components/CategoryPerformanceChart';
export { CoinStatement } from 'src/features/dashboard/components/CoinStatement';
