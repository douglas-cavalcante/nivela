import { act, renderHook, waitFor } from '@testing-library/react';
import type { Paginated } from '@nivela/api-contract';
import { usePaginatedList } from 'src/hooks/usePaginatedList';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const pageOf = (items: string[], page = 1): Paginated<string> => ({
  data: items,
  meta: { page, per_page: 15, total: items.length, last_page: 1 },
});

describe('usePaginatedList', () => {
  it('carrega ao montar: loading, sem meta, até a resposta chegar', async () => {
    const d = deferred<Paginated<string>>();
    const { result } = renderHook(() => usePaginatedList(() => d.promise));
    expect(result.current.loading).toBe(true);
    expect(result.current.rows).toEqual([]);
    expect(result.current.meta).toBeUndefined();

    await act(async () => d.resolve(pageOf(['a'])));

    expect(result.current.rows).toEqual(['a']);
    expect(result.current.meta).toEqual({ page: 1, per_page: 15, total: 1, last_page: 1 });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('ignora a resposta lenta da chave antiga e cancela a busca', async () => {
    const a = deferred<Paginated<string>>();
    const b = deferred<Paginated<string>>();
    const signals: AbortSignal[] = [];
    const { result, rerender } = renderHook(
      ({ k }) =>
        usePaginatedList((signal) => {
          signals.push(signal);
          return k === 'A' ? a.promise : b.promise;
        }, k),
      { initialProps: { k: 'A' } },
    );

    rerender({ k: 'B' });
    expect(signals[0]?.aborted).toBe(true);
    expect(result.current.loading).toBe(true);

    await act(async () => b.resolve(pageOf(['b'], 2)));
    await act(async () => a.resolve(pageOf(['a'])));

    expect(result.current.rows).toEqual(['b']);
    expect(result.current.meta?.page).toBe(2);
    expect(result.current.loading).toBe(false);
  });

  it('mudar a chave volta a loading, sem mostrar a lista antiga como atual', async () => {
    const b = deferred<Paginated<string>>();
    const { result, rerender } = renderHook(
      ({ k }) => usePaginatedList(() => (k === 'A' ? Promise.resolve(pageOf(['a'])) : b.promise), k),
      { initialProps: { k: 'A' } },
    );
    await waitFor(() => expect(result.current.rows).toEqual(['a']));

    rerender({ k: 'B' });
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    await act(async () => b.resolve(pageOf(['b'])));
    expect(result.current.rows).toEqual(['b']);
  });

  it('um reload superado por outro não encerra o loading cedo', async () => {
    const first = deferred<Paginated<string>>();
    const second = deferred<Paginated<string>>();
    const queue = [Promise.resolve(pageOf(['x'])), first.promise, second.promise];
    let i = 0;
    const { result } = renderHook(() => usePaginatedList(() => queue[i++] ?? Promise.resolve(pageOf([]))));
    await waitFor(() => expect(result.current.rows).toEqual(['x']));

    let p1!: Promise<void>;
    let p2!: Promise<void>;
    act(() => {
      p1 = result.current.reload();
      p2 = result.current.reload();
    });
    await act(async () => first.resolve(pageOf(['velho'])));
    expect(result.current.loading).toBe(true);
    expect(result.current.rows).toEqual(['x']);

    await act(async () => {
      second.resolve(pageOf(['novo']));
      await Promise.all([p1, p2]);
    });
    expect(result.current.rows).toEqual(['novo']);
    expect(result.current.loading).toBe(false);
  });

  it('erro: mostra a mensagem, sem linhas nem meta, e reload se recupera', async () => {
    const failing = deferred<Paginated<string>>();
    let calls = 0;
    const { result } = renderHook(() =>
      usePaginatedList(() => (++calls === 1 ? failing.promise : Promise.resolve(pageOf(['ok'])))),
    );

    await act(async () => failing.reject(new Error('boom')));
    expect(result.current.loading).toBe(false);
    expect(result.current.rows).toEqual([]);
    expect(result.current.meta).toBeUndefined();
    expect(result.current.error).toEqual(expect.any(String));
    expect(result.current.error).not.toBe('');

    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.rows).toEqual(['ok']);
  });
});
