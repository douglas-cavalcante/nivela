import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { AuthProvider, useAuth } from 'src/lib/auth/AuthContext';
import { getToken, setToken } from 'src/lib/auth/tokenStorage';
import { API_URL, server } from 'src/test/server';
import { teacher } from 'src/test/users';

function Probe() {
  const { user, loading, signIn, signOut } = useAuth();
  if (loading) return <p>carregando</p>;
  return (
    <div>
      <p>{user ? `logado:${user.name}` : 'deslogado'}</p>
      <button onClick={() => signIn('novo', teacher)}>entrar</button>
      <button onClick={() => void signOut()}>sair</button>
    </div>
  );
}

const renderProbe = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

describe('AuthProvider', () => {
  it('sem token não consulta a API e fica deslogado', () => {
    renderProbe();
    expect(screen.getByText('deslogado')).toBeInTheDocument();
  });

  it('com token carrega o usuário em GET /auth/me', async () => {
    server.use(http.get(`${API_URL}/auth/me`, () => HttpResponse.json({ user: teacher })));
    setToken('abc');
    renderProbe();
    expect(screen.getByText('carregando')).toBeInTheDocument();
    expect(await screen.findByText(`logado:${teacher.name}`)).toBeInTheDocument();
  });

  it('token inválido: limpa o token e fica deslogado', async () => {
    server.use(
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 })),
    );
    setToken('velho');
    renderProbe();
    expect(await screen.findByText('deslogado')).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });

  it('signIn guarda o token e o usuário', async () => {
    renderProbe();
    await userEvent.click(screen.getByRole('button', { name: 'entrar' }));
    expect(screen.getByText(`logado:${teacher.name}`)).toBeInTheDocument();
    expect(getToken()).toBe('novo');
  });

  it('signOut chama POST /auth/logout e limpa a sessão', async () => {
    const logout = vi.fn();
    server.use(
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json({ user: teacher })),
      http.post(`${API_URL}/auth/logout`, () => {
        logout();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    setToken('abc');
    renderProbe();
    await screen.findByText(`logado:${teacher.name}`);

    await userEvent.click(screen.getByRole('button', { name: 'sair' }));

    await waitFor(() => expect(screen.getByText('deslogado')).toBeInTheDocument());
    expect(logout).toHaveBeenCalledTimes(1);
    expect(getToken()).toBeNull();
  });

  it('signOut limpa a sessão mesmo se a API falhar', async () => {
    server.use(
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json({ user: teacher })),
      http.post(`${API_URL}/auth/logout`, () => HttpResponse.json({ message: 'Erro' }, { status: 500 })),
    );
    setToken('abc');
    renderProbe();
    await screen.findByText(`logado:${teacher.name}`);

    await userEvent.click(screen.getByRole('button', { name: 'sair' }));

    await waitFor(() => expect(screen.getByText('deslogado')).toBeInTheDocument());
    expect(getToken()).toBeNull();
  });
});
