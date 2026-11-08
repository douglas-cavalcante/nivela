import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SearchField } from 'src/components/SearchField';
import { renderWithProviders } from 'src/test/render';

describe('SearchField', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('só avisa a busca 300 ms depois da última tecla', async () => {
    const onChange = vi.fn();
    renderWithProviders(<SearchField label="Buscar" value="" onChange={onChange} />);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'fra');
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('fra');
  });

  it('acompanha o valor vindo de fora (ex.: botão voltar)', () => {
    const { rerender } = renderWithProviders(<SearchField label="Buscar" value="a" onChange={vi.fn()} />);
    expect(screen.getByRole('searchbox')).toHaveValue('a');
    rerender(<SearchField label="Buscar" value="b" onChange={vi.fn()} />);
    expect(screen.getByRole('searchbox')).toHaveValue('b');
  });
});
