import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { AsyncAutocomplete } from 'src/components/AsyncAutocomplete';

interface Item {
  id: number;
  name: string;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Harness({
  load,
  onChange,
  initial = null,
}: {
  load: (search: string, signal: AbortSignal) => Promise<Item[]>;
  onChange?: (value: Item | null) => void;
  initial?: Item | null;
}) {
  const [value, setValue] = useState<Item | null>(initial);
  return (
    <AsyncAutocomplete<Item>
      label="Professor"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      load={load}
      getOptionLabel={(item) => item.name}
      getOptionKey={(item) => item.id}
    />
  );
}

describe('AsyncAutocomplete', () => {
  it('digitar busca no servidor depois de 300 ms com o texto', async () => {
    const load = vi.fn().mockResolvedValue([{ id: 1, name: 'Ana' }]);
    render(<Harness load={load} />);

    await userEvent.type(screen.getByRole('combobox', { name: 'Professor' }), 'an');

    await waitFor(() => expect(load).toHaveBeenLastCalledWith('an', expect.any(AbortSignal)));
    expect(load).not.toHaveBeenCalledWith('a', expect.anything());
    expect(await screen.findByRole('option', { name: 'Ana' })).toBeInTheDocument();
  });

  it('mostra "Carregando…" e, sem resultados, "Nada encontrado."', async () => {
    const d = deferred<Item[]>();
    render(<Harness load={() => d.promise} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Professor' }));
    expect(await screen.findByText('Carregando…')).toBeInTheDocument();

    d.resolve([]);
    expect(await screen.findByText('Nada encontrado.')).toBeInTheDocument();
  });

  it('ignora a resposta atrasada da busca anterior e cancela a busca', async () => {
    const first = deferred<Item[]>();
    const second = deferred<Item[]>();
    const signals: AbortSignal[] = [];
    const load = vi.fn((search: string, signal: AbortSignal) => {
      signals.push(signal);
      return search === '' ? first.promise : second.promise;
    });
    render(<Harness load={load} />);

    const input = screen.getByRole('combobox', { name: 'Professor' });
    await userEvent.click(input);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    await userEvent.type(input, 'be');
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(signals[0]?.aborted).toBe(true);

    second.resolve([{ id: 2, name: 'Bela' }]);
    expect(await screen.findByRole('option', { name: 'Bela' })).toBeInTheDocument();
    first.resolve([{ id: 1, name: 'Antiga' }]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('option', { name: 'Antiga' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Bela' })).toBeInTheDocument();
  });

  it('erro da busca mostra a mensagem', async () => {
    render(<Harness load={() => Promise.reject(new Error('falhou'))} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Professor' }));

    expect(await screen.findByText('Não foi possível carregar as opções.')).toBeInTheDocument();
  });

  it('selecionar chama onChange com o objeto', async () => {
    const onChange = vi.fn();
    render(<Harness load={() => Promise.resolve([{ id: 3, name: 'Carla' }])} onChange={onChange} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Professor' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Carla' }));

    expect(onChange).toHaveBeenCalledWith({ id: 3, name: 'Carla' });
    expect(screen.getByRole('combobox', { name: 'Professor' })).toHaveValue('Carla');
  });

  it('aguarda 300 ms sem digitação antes de buscar (relógio falso)', () => {
    vi.useFakeTimers();
    try {
      const load = vi.fn().mockResolvedValue([]);
      render(<Harness load={load} />);

      const input = screen.getByRole('combobox', { name: 'Professor' });
      act(() => input.focus());
      fireEvent.change(input, { target: { value: 'an' } });
      const searchedAn = () => load.mock.calls.filter(([text]) => text === 'an').length;
      act(() => vi.advanceTimersByTime(250));
      expect(searchedAn()).toBe(0);
      act(() => vi.advanceTimersByTime(100));
      expect(searchedAn()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('inclui o valor selecionado nas opções quando a busca não o traz, sem aviso do MUI', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      render(<Harness initial={{ id: 1, name: 'Ana' }} load={() => Promise.resolve([{ id: 2, name: 'Bela' }])} />);

      await userEvent.click(screen.getByRole('combobox', { name: 'Professor' }));

      expect(await screen.findByRole('option', { name: 'Bela' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Ana' })).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it('depois de escolher, reabrir lista tudo de novo (a busca é zerada)', async () => {
    const load = vi.fn((search: string) =>
      Promise.resolve(
        [
          { id: 1, name: 'Ana' },
          { id: 2, name: 'Bela' },
        ].filter((item) => item.name.toLowerCase().includes(search.toLowerCase())),
      ),
    );
    render(<Harness load={load} />);

    const input = screen.getByRole('combobox', { name: 'Professor' });
    await userEvent.type(input, 'be');
    await userEvent.click(await screen.findByRole('option', { name: 'Bela' }));
    expect(input).toHaveValue('Bela');

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() => expect(load).toHaveBeenLastCalledWith('', expect.any(AbortSignal)));
    expect(await screen.findByRole('option', { name: 'Ana' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bela' })).toBeInTheDocument();
  });
});
