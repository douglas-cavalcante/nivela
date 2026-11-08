import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from 'src/app/layouts/AppLayout';
import { menuItems } from 'src/app/layouts/AppLayout/menu';
import { AuthLayout } from 'src/app/layouts/AuthLayout';
import { ComingSoon } from 'src/app/routes/ComingSoon';
import { HomePage } from 'src/app/routes/HomePage';
import { ProtectedRoute } from 'src/app/routes/ProtectedRoute';
import { Login } from 'src/features/auth';

// As rotas das features entram aqui conforme forem construídas; até lá, "Em breve".
const placeholders = menuItems.filter((item) => item.path !== '/');

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          {placeholders
            .filter((item) => item.roles.includes('teacher'))
            .map((item) => (
              <Route key={item.path} path={item.path} element={<ComingSoon title={item.label} />} />
            ))}
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route element={<AppLayout />}>
          {placeholders
            .filter((item) => !item.roles.includes('teacher'))
            .map((item) => (
              <Route key={item.path} path={item.path} element={<ComingSoon title={item.label} />} />
            ))}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
