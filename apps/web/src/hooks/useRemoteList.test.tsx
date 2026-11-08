import { act, renderHook, waitFor } from '@testing-library/react';
import { useRemoteList } from 'src/hooks/useRemoteList';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useRemoteList', () => {
  it('carrega ao montar: loading até a resposta chegar', async () => {
    const d = deferred<string[]>();
    const { result } = renderHook(() => useRemoteList(() => d.promise));
    expect(result.current.loading).toBe(true);
    expect(result.current.rows).toEqual([]);

    await act(async () => d.resolve(['a']));

    expect(result.current.rows).toEqual(['a']);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('ignora a resposta lenta da chave antiga e cancela a busca', async () => {
    const a = deferred<string[]>();
    const b = deferred<string[]>();
    const signals: AbortSignal[] = [];
    const { result, rerender } = renderHook(
      ({ k }) =>
        useRemoteList((signal) => {
          signals.push(signal);
          return k === 'A' ? a.promise : b.promise;
        }, k),
      { initialProps: { k: 'A' } },
    );

    rerender({ k: 'B' });
    expect(signals[0]?.aborted).toBe(true);
    expect(result.current.loading).toBe(true);

    await act(async () => b.resolve(['b']));
    await act(async () => a.resolve(['a']));

    expect(result.current.rows).toEqual(['b']);
    expect(result.current.loading).toBe(false);
  });

  it('mudar a chave volta a loading, sem mostrar linhas da chave antiga como atuais', async () => {
    const b = deferred<string[]>();
    const { result, rerender } = renderHook(({ k }) => useRemoteList(() => (k === 'A' ? Promise.resolve(['a']) : b.promise), k), {
      initialProps: { k: 'A' },
    });
    await waitFor(() => expect(result.current.rows).toEqual(['a']));

    rerender({ k: 'B' });
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    await act(async () => b.resolve(['b']));
    expect(result.current.rows).toEqual(['b']);
  });

  it('reload atualiza as linhas e fica em loading enquanto busca', async () => {
    let data = ['a'];
    const second = deferred<string[]>();
    let calls = 0;
    const { result } = renderHook(() =>
      useRemoteList(() => {
        calls += 1;
        return calls === 1 ? Promise.resolve(data) : second.promise;
      }),
    );
    await waitFor(() => expect(result.current.rows).toEqual(['a']));

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.reload();
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.rows).toEqual(['a']);

    data = ['a', 'b'];
    await act(async () => {
      second.resolve(['a', 'b']);
      await pending;
    });

    expect(result.current.rows).toEqual(['a', 'b']);
    expect(result.current.loading).toBe(false);
  });

  it('um reload superado por outro não encerra o loading cedo', async () => {
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    const third = deferred<string[]>();
    const queue = [Promise.resolve(['x']), first.promise, second.promise];
    void third;
    let i = 0;
    const { result } = renderHook(() => useRemoteList(() => queue[i++] ?? Promise.resolve([])));
    await waitFor(() => expect(result.current.rows).toEqual(['x']));

    let p1!: Promise<void>;
    let p2!: Promise<void>;
    act(() => {
      p1 = result.current.reload();
      p2 = result.current.reload();
    });
    await act(async () => first.resolve(['velho']));
    expect(result.current.loading).toBe(true);
    expect(result.current.rows).toEqual(['x']);

    await act(async () => {
      second.resolve(['novo']);
      await Promise.all([p1, p2]);
    });
    expect(result.current.rows).toEqual(['novo']);
    expect(result.current.loading).toBe(false);
  });

  it('erro: mostra a mensagem, sem linhas, e reload se recupera', async () => {
    const failing = deferred<string[]>();
    let calls = 0;
    const { result } = renderHook(() => useRemoteList(() => (++calls === 1 ? failing.promise : Promise.resolve(['ok']))));
    expect(result.current.loading).toBe(true);

    await act(async () => failing.reject(new Error('boom')));
    expect(result.current.loading).toBe(false);
    expect(result.current.rows).toEqual([]);
    expect(result.current.error).toEqual(expect.any(String));
    expect(result.current.error).not.toBe('');
    expect(result.current.errorStatus).toBeNull(); // sem resposta HTTP

    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.errorStatus).toBeNull();
    expect(result.current.rows).toEqual(['ok']);
  });

  it('erro HTTP: expõe o status (ex.: 404 para "não encontrado")', async () => {
    // Mesmo formato de um erro do axios (axios.isAxiosError lê `isAxiosError`).
    const notFound = { isAxiosError: true, response: { status: 404, data: { message: 'Turma não encontrada.' } } };
    const { result } = renderHook(() => useRemoteList(() => Promise.reject(notFound)));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Turma não encontrada.');
    expect(result.current.errorStatus).toBe(404);
  });
});
