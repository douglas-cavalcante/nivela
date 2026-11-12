import { lazy } from 'react';

// API pública da feature dashboard.
export const Home = lazy(() => import('src/features/dashboard/pages/Home').then((m) => ({ default: m.Home })));
