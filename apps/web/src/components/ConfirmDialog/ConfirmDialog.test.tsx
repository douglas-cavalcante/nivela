import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { vi } from 'vitest';
import { ConfirmDialog } from 'src/components/ConfirmDialog';
import { renderWithProviders } from 'src/test/render';

function setup(props: Partial<ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(
    <ConfirmDialog
      open
      title="Excluir disciplina?"
      description="Isso não pode ser desfeito."
      confirmLabel="Excluir"
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />,
  );
  return { onConfirm, onClose };
}

describe('ConfirmDialog', () => {
  it('mostra título e descrição no diálogo', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Excluir disciplina?' })).toBeInTheDocument();
    expect(screen.getByText('Isso não pode ser desfeito.')).toBeInTheDocument();
  });

  it('confirma', async () => {
    const { onConfirm } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancela pelo botão e pelo Esc', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('desabilita os botões e ignora o Esc enquanto carrega', async () => {
    const { onConfirm, onClose } = setup({ loading: true });
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
