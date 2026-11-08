import { screen, userEvent } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { FakeHandler } from 'src/test/render';
import { renderApp } from 'src/test/render';
import { student } from 'src/test/users';

type User = ReturnType<typeof userEvent.setup>;

const submit = (user: User) => user.press(screen.getByRole('button', { name: 'Entrar' }));

async function fillForm(user: User, email = ' Ana@Escola.com ', password = 'segredo123') {
  await user.type(screen.getByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), password);
}

describe('boas-vindas', () => {
  it('mostra o título manuscrito e leva ao login', async () => {
    const user = userEvent.setup();
    const { getPathname } = await renderApp();

    expect(await screen.findByText('Oi! Bora nivelar?')).toBeTruthy();

    await user.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(getPathname()).toBe('/login');
  });

  it('o botão do código da turma leva ao cadastro', async () => {
    const user = userEvent.setup();
    const { getPathname } = await renderApp();

    await user.press(await screen.findByRole('button', { name: 'Tenho um código de turma' }));

    expect(getPathname()).toBe('/register');
    expect(screen.getByLabelText('Código da turma')).toBeTruthy();
  });
});

describe('login', () => {
  it('entra no app e envia o canal mobile', async () => {
    const login = jest.fn<ReturnType<FakeHandler>, Parameters<FakeHandler>>(() => ({
      status: 200,
      data: { token: 'token-novo', user: student },
    }));
    const user = userEvent.setup();
    const { getPathname } = await renderApp({
      initialUrl: '/login',
      routes: { 'POST /auth/login': login, 'GET /auth/me': () => ({ status: 200, data: { user: student } }) },
    });

    await fillForm(user);
    await submit(user);

    expect(await screen.findByText('Início')).toBeTruthy();
    expect(getPathname()).toBe('/');
    expect(login.mock.calls[0][0]).toEqual({ email: 'ana@escola.com', password: 'segredo123', channel: 'mobile' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('nivela.token', 'token-novo');
  });

  it('login com mensagem de professor', async () => {
    const user = userEvent.setup();
    await renderApp({
      initialUrl: '/login',
      routes: {
        'POST /auth/login': () => ({
          status: 403,
          data: { message: 'Professores e administradores acessam pelo painel web.' },
        }),
      },
    });

    await fillForm(user);
    await submit(user);

    expect(await screen.findByText('Professores e administradores acessam pelo painel web.')).toBeTruthy();
    expect(screen.queryByText('Início')).toBeNull();
  });

  it('mostra e-mail ou senha inválidos', async () => {
    const user = userEvent.setup();
    await renderApp({
      initialUrl: '/login',
      routes: {
        'POST /auth/login': () => ({
          status: 422,
          data: { message: 'Dados inválidos.', errors: { email: ['E-mail ou senha inválidos.'] } },
        }),
      },
    });

    await fillForm(user);
    await submit(user);

    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeTruthy();
  });

  it('valida campos vazios sem chamar a API', async () => {
    const login = jest.fn<ReturnType<FakeHandler>, Parameters<FakeHandler>>(() => ({ status: 200 }));
    const user = userEvent.setup();
    await renderApp({ initialUrl: '/login', routes: { 'POST /auth/login': login } });

    await submit(user);

    expect(await screen.findByText('Informe seu e-mail')).toBeTruthy();
    expect(screen.getByText('Informe sua senha')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it('desativa o botão enquanto envia', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const user = userEvent.setup();
    await renderApp({
      initialUrl: '/login',
      routes: {
        'POST /auth/login': async () => {
          await gate;
          return { status: 403, data: { message: 'Usuário desativado.' } };
        },
      },
    });

    await fillForm(user);
    await submit(user);

    const busy = await screen.findByRole('button', { name: 'Entrando…' });
    expect(busy).toBeDisabled();

    release();
    expect(await screen.findByText('Usuário desativado.')).toBeTruthy();
  });
});
