import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { vi } from 'vitest';
import { ResourceState } from 'src/components/ResourceState';
import { renderWithProviders } from 'src/test/render';

describe('ResourceState', () => {
  it('não encontrado: a mensagem é o título e o link volta para a lista', async () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/turmas/9"
          element={<ResourceState kind="not-found" message="Turma não encontrada." backTo={{ to: '/turmas', label: 'Voltar' }} />}
        />
        <Route path="/turmas" element={<p>Lista de turmas</p>} />
      </Routes>,
      { route: '/turmas/9' },
    );

    expect(screen.getByRole('heading', { name: 'Turma não encontrada.' })).toBeInTheDocument();
    expect(screen.queryByText('Não deu para carregar.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
    await userEvent.click(screen.getByRole('link', { name: 'Voltar' }));
    expect(await screen.findByText('Lista de turmas')).toBeInTheDocument();
  });

  it('erro: "Não deu para carregar." com a mensagem e o botão de tentar de novo', async () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <ResourceState
        kind="error"
        message="Sem conexão."
        onRetry={onRetry}
        backTo={{ to: '/alunos', label: 'Voltar' }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Não deu para carregar.' })).toBeInTheDocument();
    expect(screen.getByText('Sem conexão.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/alunos');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('erro sem onRetry nem backTo não mostra botões', () => {
    renderWithProviders(<ResourceState kind="error" message="Falhou." />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
