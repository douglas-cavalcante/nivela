import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { AppRoutes } from 'src/app/routes';
import { getToken, setToken } from 'src/lib/auth/tokenStorage';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { NotifyProvider } from 'src/lib/notify/NotifyProvider';
import { admin, teacher } from 'src/test/users';

async function login() {
  await userEvent.type(await screen.findByLabelText('E-mail'), admin.email);
  await userEvent.type(screen.getByLabelText('Senha'), 'segredo123');
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('AppRoutes', () => {
  it('rota protegida sem login redireciona para /login', async () => {
    renderWithProviders(<AppRoutes />, { route: '/', realAuth: true });
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('entra e vai para o Início', async () => {
    server.use(http.post(`${API_URL}/auth/login`, () => HttpResponse.json({ token: 'tok', user: admin })));
    renderWithProviders(<AppRoutes />, { route: '/login', realAuth: true });

    await login();

    expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument();
  });

  it('volta para a página que a pessoa tentou abrir', async () => {
    server.use(http.post(`${API_URL}/auth/login`, () => HttpResponse.json({ token: 'tok', user: admin })));
    renderWithProviders(<AppRoutes />, { route: '/perfil', realAuth: true });

    await login();

    expect(await screen.findByRole('heading', { name: 'Meu perfil' })).toBeInTheDocument();
  });

  it('sai pelo menu e volta ao login', async () => {
    server.use(
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json({ user: admin })),
      http.post(`${API_URL}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
    );
    setToken('abc');
    renderWithProviders(<AppRoutes />, { route: '/', realAuth: true });

    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });

  it('professor logado não vê /professores: volta para o Início', async () => {
    renderWithProviders(<AppRoutes />, { user: teacher, route: '/professores' });
    expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Professores' })).toBeNull();
  });

  it('admin abre a lista de professores em /professores', async () => {
    server.use(
      http.get(`${API_URL}/teachers`, () =>
        HttpResponse.json({
          data: [{ id: 5, name: 'Maria Souza', email: 'maria@nivela.dev', active: true, classrooms_count: 3, created_at: '2026-01-10T12:00:00.000Z' }],
          meta: { page: 1, per_page: 15, total: 1, last_page: 1 },
        }),
      ),
    );
    renderWithProviders(
      <NotifyProvider>
        <AppRoutes />
      </NotifyProvider>,
      { user: admin, route: '/professores' },
    );
    expect(await screen.findByRole('heading', { name: 'Professores' })).toBeInTheDocument();
    expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
  });
});
