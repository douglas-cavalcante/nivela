import { lazy } from 'react';

// API pública da feature auth: o que o resto do app (src/app) pode usar.
// As páginas são carregadas sob demanda (cada uma vira um chunk próprio).
export const Login = lazy(() => import('src/features/auth/pages/Login').then((m) => ({ default: m.Login })));
export const Profile = lazy(() => import('src/features/auth/pages/Profile').then((m) => ({ default: m.Profile })));
