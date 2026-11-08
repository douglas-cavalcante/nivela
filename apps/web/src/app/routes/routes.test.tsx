import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { AppRoutes } from 'src/app/routes';
import { getToken, setToken } from 'src/lib/auth/tokenStorage';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { admin } from 'src/test/users';

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
});
