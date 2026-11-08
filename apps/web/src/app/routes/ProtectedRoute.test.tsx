import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { ProtectedRoute } from 'src/app/routes/ProtectedRoute';
import { renderWithProviders } from 'src/test/render';
import { admin, teacher } from 'src/test/users';

const routes = (
  <Routes>
    <Route path="/login" element={<p>tela de login</p>} />
    <Route element={<ProtectedRoute />}>
      <Route path="/" element={<p>início</p>} />
    </Route>
    <Route element={<ProtectedRoute roles={['admin']} />}>
      <Route path="/professores" element={<p>professores</p>} />
    </Route>
  </Routes>
);

describe('ProtectedRoute', () => {
  it('redireciona para /login quando não há usuário', () => {
    renderWithProviders(routes, { user: null, route: '/' });
    expect(screen.getByText('tela de login')).toBeInTheDocument();
  });

  it('mostra o conteúdo para usuário autenticado', () => {
    renderWithProviders(routes, { user: teacher, route: '/' });
    expect(screen.getByText('início')).toBeInTheDocument();
  });

  it('não redireciona enquanto a sessão carrega', () => {
    renderWithProviders(routes, { user: null, loading: true, route: '/' });
    expect(screen.queryByText('tela de login')).toBeNull();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('professor não acessa rota só de admin', () => {
    renderWithProviders(routes, { user: teacher, route: '/professores' });
    expect(screen.getByText('início')).toBeInTheDocument();
  });

  it('admin acessa rota só de admin', () => {
    renderWithProviders(routes, { user: admin, route: '/professores' });
    expect(screen.getByText('professores')).toBeInTheDocument();
  });
});
