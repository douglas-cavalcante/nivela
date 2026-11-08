import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppLayout } from 'src/app/layouts/AppLayout';
import { renderWithProviders } from 'src/test/render';
import { admin, teacher } from 'src/test/users';

describe('AppLayout', () => {
  it('admin vê o menu Professores', () => {
    renderWithProviders(<AppLayout />, { user: admin });
    expect(screen.getByRole('link', { name: /professores/i })).toBeInTheDocument();
  });

  it('professor não vê o menu Professores', () => {
    renderWithProviders(<AppLayout />, { user: teacher });
    expect(screen.queryByRole('link', { name: /professores/i })).toBeNull();
  });

  it('marca o item ativo', () => {
    renderWithProviders(<AppLayout />, { user: teacher, route: '/questoes' });
    expect(screen.getByRole('link', { name: /questões/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /turmas/i })).not.toHaveAttribute('aria-current');
  });

  it('marca Início só na raiz', () => {
    renderWithProviders(<AppLayout />, { user: teacher, route: '/questoes' });
    expect(screen.getByRole('link', { name: /início/i })).not.toHaveAttribute('aria-current');
  });

  it('mostra o nome do usuário e permite sair', async () => {
    const { auth } = renderWithProviders(<AppLayout />, { user: teacher });
    expect(screen.getByText(teacher.name)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /sair/i }));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('alterna o tema claro/escuro', async () => {
    renderWithProviders(<AppLayout />, { user: teacher });
    await userEvent.click(screen.getByRole('button', { name: /usar tema escuro/i }));
    expect(screen.getByRole('button', { name: /usar tema claro/i })).toBeInTheDocument();
  });
});
