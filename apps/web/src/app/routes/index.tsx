import { Box, CircularProgress } from '@mui/material';
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { AppLayout } from 'src/app/layouts/AppLayout';
import { menuItems } from 'src/app/layouts/AppLayout/menu';
import { AuthLayout } from 'src/app/layouts/AuthLayout';
import { ProtectedRoute } from 'src/app/routes/ProtectedRoute';
import { Login, Profile } from 'src/features/auth';
import { CategoryList } from 'src/features/categories';
import { SubjectList } from 'src/features/subjects';
import { TeacherList } from 'src/features/teachers';

const HomePage = lazy(() => import('src/app/routes/HomePage').then((m) => ({ default: m.HomePage })));
const ComingSoon = lazy(() => import('src/app/routes/ComingSoon').then((m) => ({ default: m.ComingSoon })));

/** Cada página é carregada sob demanda; enquanto isso o layout continua na tela e só o miolo mostra o spinner. */
function Page({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
    <Suspense
      fallback={
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress aria-label="Carregando" />
        </Box>
      }
    >
      {children}
    </Suspense>
    </ErrorBoundary>
  );
}

function page(element: ReactNode) {
  return <Page>{element}</Page>;
}

// As rotas das features entram aqui conforme forem construídas; até lá, "Em breve".
const implemented = ['/', '/disciplinas', '/categorias', '/professores'];
const placeholders = menuItems.filter((item) => !implemented.includes(item.path));

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={page(<Login />)} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={page(<HomePage />)} />
          <Route path="/perfil" element={page(<Profile />)} />
          <Route path="/disciplinas" element={page(<SubjectList />)} />
          <Route path="/categorias" element={page(<CategoryList />)} />
          {placeholders
            .filter((item) => item.roles.includes('teacher'))
            .map((item) => (
              <Route key={item.path} path={item.path} element={page(<ComingSoon title={item.label} />)} />
            ))}
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route element={<AppLayout />}>
          <Route path="/professores" element={page(<TeacherList />)} />
          {placeholders
            .filter((item) => !item.roles.includes('teacher'))
            .map((item) => (
              <Route key={item.path} path={item.path} element={page(<ComingSoon title={item.label} />)} />
            ))}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
