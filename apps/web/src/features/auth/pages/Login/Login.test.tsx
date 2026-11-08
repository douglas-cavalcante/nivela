import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { Login } from 'src/features/auth/pages/Login';
import { getToken } from 'src/lib/auth/tokenStorage';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { teacher } from 'src/test/users';

const routes = (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<p>tela inicial</p>} />
  </Routes>
);

const renderLogin = () => renderWithProviders(routes, { route: '/login', realAuth: true });

async function fillAndSubmit(email: string, password: string) {
  await userEvent.type(screen.getByLabelText('E-mail'), email);
  await userEvent.type(screen.getByLabelText('Senha'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('Login', () => {
  it('entra, guarda a sessão e vai para o início enviando channel web', async () => {
    const body = vi.fn();
    server.use(
      http.post(`${API_URL}/auth/login`, async ({ request }) => {
        body(await request.json());
        return HttpResponse.json({ token: 'tok', user: teacher });
      }),
    );
    renderLogin();

    await fillAndSubmit(' paulo@nivela.dev ', 'segredo123');

    expect(await screen.findByText('tela inicial')).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({
      email: 'paulo@nivela.dev',
      password: 'segredo123',
      channel: 'web',
    });
    expect(getToken()).toBe('tok');
  });

  it('mostra erro de credenciais', async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json(
          {
            message: 'Dados inválidos.',
            errors: { email: ['E-mail ou senha inválidos.'] },
          },
          { status: 422 },
        ),
      ),
    );
    renderLogin();

    await fillAndSubmit('paulo@nivela.dev', 'errada123');

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.');
    expect(getToken()).toBeNull();
  });

  it('mostra a mensagem para aluno', async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json({ message: 'Alunos acessam pelo aplicativo Nivela.' }, { status: 403 }),
      ),
    );
    renderLogin();

    await fillAndSubmit('aluno@nivela.dev', 'segredo123');

    expect(await screen.findByRole('alert')).toHaveTextContent('Alunos acessam pelo aplicativo Nivela.');
  });

  it('avisa quando a API está fora do ar', async () => {
    server.use(http.post(`${API_URL}/auth/login`, () => HttpResponse.error()));
    renderLogin();

    await fillAndSubmit('paulo@nivela.dev', 'segredo123');

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar ao servidor');
  });

  it('valida campos vazios sem chamar a API', async () => {
    const called = vi.fn();
    server.use(
      http.post(`${API_URL}/auth/login`, () => {
        called();
        return HttpResponse.json({});
      }),
    );
    renderLogin();

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe seu e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument();
    expect(called).not.toHaveBeenCalled();
  });

  it('valida e-mail malformado sem chamar a API', async () => {
    renderLogin();

    await fillAndSubmit('sem-arroba', 'segredo123');

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
  });

  it('Enter envia o formulário e o botão fica em carregamento', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${API_URL}/auth/login`, async () => {
        await gate;
        return HttpResponse.json({ token: 'tok', user: teacher });
      }),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText('E-mail'), 'paulo@nivela.dev');
    await userEvent.type(screen.getByLabelText('Senha'), 'segredo123{Enter}');

    const button = await screen.findByRole('button', { name: /entrando/i });
    expect(button).toBeDisabled();

    release();
    expect(await screen.findByText('tela inicial')).toBeInTheDocument();
  });

  it('alterna a visibilidade da senha', async () => {
    renderLogin();
    const input = screen.getByLabelText('Senha');
    expect(input).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(input).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('quem já está logado vai direto para o início', async () => {
    renderWithProviders(routes, { route: '/login', user: teacher });
    await waitFor(() => expect(screen.getByText('tela inicial')).toBeInTheDocument());
  });
});
