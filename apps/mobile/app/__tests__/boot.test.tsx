import { act, fireEvent, screen } from 'expo-router/testing-library';
import { getToken } from 'src/lib/auth/tokenStorage';
import { networkError, renderApp } from 'src/test/render';
import { student } from 'src/test/users';

describe('abertura do app com sessão salva', () => {
  it('sem resposta da API: mantém o token e mostra "Sem conexão com o servidor."', async () => {
    await renderApp({ user: student, routes: { 'GET /auth/me': networkError } });

    expect(await screen.findByText('Sem conexão com o servidor.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
    expect(screen.queryByText('Oi! Bora nivelar?')).toBeNull();
    expect(await getToken()).toBe('token-de-teste');
  });

  it('erro 5xx também mostra a tela de reconexão', async () => {
    await renderApp({
      user: student,
      routes: { 'GET /auth/me': () => ({ status: 503, data: { message: 'Erro interno do servidor.' } }) },
    });

    expect(await screen.findByText('Sem conexão com o servidor.')).toBeTruthy();
    expect(await getToken()).toBe('token-de-teste');
  });

  it('"Tentar de novo" refaz a checagem e, com sucesso, abre as abas', async () => {
    let calls = 0;
    await renderApp({
      user: student,
      routes: {
        'GET /auth/me': (body, config) => {
          calls += 1;
          return calls === 1 ? networkError(body, config) : { status: 200, data: { user: student } };
        },
      },
    });
    expect(await screen.findByText('Sem conexão com o servidor.')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    });

    expect(await screen.findByText('Início')).toBeTruthy();
    expect(screen.queryByText('Sem conexão com o servidor.')).toBeNull();
    expect(calls).toBe(2);
  });

  it('401: limpa o token e abre as boas-vindas', async () => {
    await renderApp({
      user: student,
      routes: { 'GET /auth/me': () => ({ status: 401, data: { message: 'Não autenticado.' } }) },
    });

    expect(await screen.findByText('Oi! Bora nivelar?')).toBeTruthy();
    expect(screen.queryByText('Sem conexão com o servidor.')).toBeNull();
    expect(await getToken()).toBeNull();
  });
});
