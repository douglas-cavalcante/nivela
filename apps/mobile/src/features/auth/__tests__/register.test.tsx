import { screen, userEvent } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { FakeHandler } from 'src/test/render';
import { renderApp } from 'src/test/render';
import { student } from 'src/test/users';

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<Record<'code' | 'name' | 'email' | 'password' | 'confirmation', string>> = {},
) {
  const values = {
    code: 'niv-4k7q',
    name: 'Ana Souza',
    email: 'ana@escola.com',
    password: 'segredo123',
    confirmation: 'segredo123',
    ...overrides,
  };
  await user.type(screen.getByLabelText('Código da turma'), values.code);
  await user.type(screen.getByLabelText('Nome'), values.name);
  await user.type(screen.getByLabelText('E-mail'), values.email);
  await user.type(screen.getByLabelText('Senha'), values.password);
  await user.type(screen.getByLabelText('Confirmar senha'), values.confirmation);
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.press(screen.getByRole('button', { name: 'Criar minha conta' }));

describe('cadastro do aluno', () => {
  it('cadastra e entra no app', async () => {
    const register = jest.fn<ReturnType<FakeHandler>, Parameters<FakeHandler>>(() => ({
      status: 201,
      data: { token: 'token-novo', user: student },
    }));
    const user = userEvent.setup();
    const { getPathname } = await renderApp({
      initialUrl: '/register',
      routes: { 'POST /auth/register-student': register, 'GET /auth/me': () => ({ status: 200, data: { user: student } }) },
    });

    await fillForm(user);
    await submit(user);

    expect(await screen.findByText('Início')).toBeTruthy();
    expect(getPathname()).toBe('/');
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0][0]).toEqual({
      name: 'Ana Souza',
      email: 'ana@escola.com',
      password: 'segredo123',
      password_confirmation: 'segredo123',
      join_code: 'NIV-4K7Q',
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('nivela.token', 'token-novo');
  });

  it('coloca o código da turma em maiúsculas enquanto a pessoa digita', async () => {
    const user = userEvent.setup();
    await renderApp({ initialUrl: '/register' });

    await user.type(screen.getByLabelText('Código da turma'), 'niv-4k7q');

    expect(screen.getByLabelText('Código da turma').props.value).toBe('NIV-4K7Q');
  });

  it('mostra erro da API no campo do código', async () => {
    const user = userEvent.setup();
    await renderApp({
      initialUrl: '/register',
      routes: {
        'POST /auth/register-student': () => ({
          status: 422,
          data: { message: 'Dados inválidos.', errors: { join_code: ['Código de turma inválido.'] } },
        }),
      },
    });

    await fillForm(user);
    await submit(user);

    expect(await screen.findByText('Código de turma inválido.')).toBeTruthy();
    expect(screen.queryByText('Início')).toBeNull();
    expect(screen.getByRole('button', { name: 'Criar minha conta' })).toBeTruthy();
  });

  it('mostra o erro de e-mail já cadastrado no campo de e-mail', async () => {
    const user = userEvent.setup();
    await renderApp({
      initialUrl: '/register',
      routes: {
        'POST /auth/register-student': () => ({
          status: 422,
          data: { message: 'Dados inválidos.', errors: { email: ['Este e-mail já está cadastrado.'] } },
        }),
      },
    });

    await fillForm(user);
    await submit(user);

    expect(await screen.findByText('Este e-mail já está cadastrado.')).toBeTruthy();
  });

  it('valida confirmação de senha sem chamar a API', async () => {
    const register = jest.fn<ReturnType<FakeHandler>, Parameters<FakeHandler>>(() => ({ status: 201 }));
    const user = userEvent.setup();
    await renderApp({ initialUrl: '/register', routes: { 'POST /auth/register-student': register } });

    await fillForm(user, { confirmation: 'outra-senha' });
    await submit(user);

    expect(await screen.findByText('As senhas não conferem')).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it('valida campos obrigatórios e senha curta sem chamar a API', async () => {
    const register = jest.fn<ReturnType<FakeHandler>, Parameters<FakeHandler>>(() => ({ status: 201 }));
    const user = userEvent.setup();
    await renderApp({ initialUrl: '/register', routes: { 'POST /auth/register-student': register } });

    await user.type(screen.getByLabelText('Nome'), '   ');
    await user.type(screen.getByLabelText('E-mail'), 'nao-e-email');
    await user.type(screen.getByLabelText('Senha'), '1234567');
    await user.type(screen.getByLabelText('Confirmar senha'), '1234567');
    await submit(user);

    expect(await screen.findByText('Informe o código da turma')).toBeTruthy();
    expect(screen.getByText('Informe seu nome')).toBeTruthy();
    expect(screen.getByText('Informe um e-mail válido.')).toBeTruthy();
    expect(screen.getByText('A senha precisa ter pelo menos 8 caracteres.')).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it('alterna a visibilidade da senha', async () => {
    const user = userEvent.setup();
    await renderApp({ initialUrl: '/register' });

    expect(screen.getByLabelText('Senha').props.secureTextEntry).toBe(true);
    await user.press(screen.getAllByRole('button', { name: 'Mostrar senha' })[0]);

    expect(screen.getByLabelText('Senha').props.secureTextEntry).toBe(false);
    expect(screen.getAllByRole('button', { name: 'Ocultar senha' })).toHaveLength(1);
  });

  it('mostra mensagem amigável quando a API está fora do ar', async () => {
    const user = userEvent.setup();
    await renderApp({
      initialUrl: '/register',
      routes: {
        'POST /auth/register-student': () => {
          throw new Error('Network Error');
        },
      },
    });

    await fillForm(user);
    await submit(user);

    expect(await screen.findByText('Algo deu errado. Tente novamente em instantes.')).toBeTruthy();
  });
});
