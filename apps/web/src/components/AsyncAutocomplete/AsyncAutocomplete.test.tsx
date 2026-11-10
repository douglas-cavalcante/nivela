import { render, screen, waitFor } from '@testing-library/react';
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
}: {
  load: (search: string, signal: AbortSignal) => Promise<Item[]>;
  onChange?: (value: Item | null) => void;
}) {
  const [value, setValue] = useState<Item | null>(null);
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
});
