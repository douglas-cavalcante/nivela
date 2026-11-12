import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';
import { FormDialog } from 'src/components/FormDialog';
import { renderWithProviders } from 'src/test/render';

function setup(loading = false) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(
    <FormDialog open title="Nova disciplina" submitLabel="Salvar" loading={loading} onSubmit={onSubmit} onClose={onClose}>
      <label>
        Nome
        <input />
      </label>
    </FormDialog>,
  );
  return { onSubmit, onClose };
}

describe('FormDialog', () => {
  it('envia com Enter', async () => {
    const { onSubmit } = setup();
    expect(screen.getByRole('dialog', { name: 'Nova disciplina' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nome'), 'Mat{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('envia pelo botão', async () => {
    const { onSubmit } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('fecha com Esc e pelo Cancelar', async () => {
    const { onClose } = setup();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('não fecha com Esc enquanto envia', async () => {
    const { onClose } = setup(true);
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });
});

describe('FormDialog - envio duplo', () => {
  it('Enter repetido rapidamente envia uma vez só', async () => {
    const { onSubmit } = setup();
    await userEvent.type(screen.getByLabelText('Nome'), 'a{Enter}{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('FormDialog - fim do envio', () => {
  it('libera novo envio assim que loading volta a false', async () => {
    const onSubmit = vi.fn();
    function Harness() {
      const [loading, setLoading] = useState(false);
      return (
        <>
          <button onClick={() => setLoading((v) => !v)}>alternar</button>
          <FormDialog open title="T" submitLabel="Salvar" loading={loading} onSubmit={onSubmit} onClose={vi.fn()}>
            <input aria-label="campo" />
          </FormDialog>
        </>
      );
    }
    renderWithProviders(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // o pai marca loading e depois libera (ex.: erro de validação do servidor)
    fireEvent.click(screen.getByText('alternar', { selector: 'button' }), {});
    fireEvent.click(screen.getByText('alternar', { selector: 'button' }), {});
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
