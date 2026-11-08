import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Profile } from 'src/features/auth/pages/Profile';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { teacher } from 'src/test/users';

async function fillPasswords(current: string, next: string, confirmation: string) {
  await userEvent.type(screen.getByLabelText('Senha atual'), current);
  await userEvent.type(screen.getByLabelText('Nova senha'), next);
  await userEvent.type(screen.getByLabelText('Confirmar nova senha'), confirmation);
  await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));
}

describe('Profile', () => {
  it('mostra os dados da pessoa logada', () => {
    renderWithProviders(<Profile />, { user: teacher });
    expect(screen.getByText(teacher.name)).toBeInTheDocument();
    expect(screen.getByText(teacher.email)).toBeInTheDocument();
    expect(screen.getByText('Professor')).toBeInTheDocument();
  });

  it('troca a senha e mostra confirmação', async () => {
    const body = vi.fn();
    server.use(
      http.put(`${API_URL}/auth/password`, async ({ request }) => {
        body(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<Profile />, { user: teacher });

    await fillPasswords('antiga123', 'nova12345', 'nova12345');

    expect(await screen.findByText('Senha alterada com sucesso.')).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({
      current_password: 'antiga123',
      password: 'nova12345',
      password_confirmation: 'nova12345',
    });
    expect(screen.getByLabelText('Senha atual')).toHaveValue('');
  });

  it('mostra o erro da API no campo da senha atual', async () => {
    server.use(
      http.put(`${API_URL}/auth/password`, () =>
        HttpResponse.json(
          {
            message: 'Dados inválidos.',
            errors: { current_password: ['A senha atual está incorreta.'] },
          },
          { status: 422 },
        ),
      ),
    );
    renderWithProviders(<Profile />, { user: teacher });

    await fillPasswords('errada123', 'nova12345', 'nova12345');

    expect(await screen.findByText('A senha atual está incorreta.')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha atual')).toBeInvalid();
    expect(screen.queryByText('Senha alterada com sucesso.')).toBeNull();
  });

  it('erro sem campo correspondente vai para o aviso do topo', async () => {
    server.use(
      http.put(`${API_URL}/auth/password`, () =>
        HttpResponse.json({ message: 'Usuário desativado.' }, { status: 403 }),
      ),
    );
    renderWithProviders(<Profile />, { user: teacher });

    await fillPasswords('antiga123', 'nova12345', 'nova12345');

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário desativado.');
  });

  it('valida confirmação e tamanho sem chamar a API', async () => {
    const called = vi.fn();
    server.use(
      http.put(`${API_URL}/auth/password`, () => {
        called();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<Profile />, { user: teacher });

    await fillPasswords('antiga123', 'curta', 'outra');

    expect(await screen.findByText('A nova senha precisa ter ao menos 8 caracteres.')).toBeInTheDocument();
    expect(screen.getByText('A confirmação de senha não confere.')).toBeInTheDocument();
    expect(called).not.toHaveBeenCalled();
  });

  it('alterna o tema claro/escuro', async () => {
    renderWithProviders(<Profile />, { user: teacher });
    const toggle = screen.getByRole('switch', { name: 'Tema escuro' });
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);

    expect(screen.getByRole('switch', { name: 'Tema escuro' })).toBeChecked();
    expect(window.localStorage.getItem('nivela.theme')).toBe('dark');
  });

  it('permite sair da conta', async () => {
    const { auth } = renderWithProviders(<Profile />, { user: teacher });
    await userEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});
