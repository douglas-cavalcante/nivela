import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRemote } from 'src/hooks/useRemote';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useRemote', () => {
  it('carrega ao montar: loading até a resposta chegar', async () => {
    const d = deferred<string>();
    const { result } = await renderHook(() => useRemote('k', () => d.promise));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await act(async () => d.resolve('a'));

    expect(result.current.data).toBe('a');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.errorStatus).toBeNull();
  });

  it('trocar a chave cancela a busca antiga e ignora a resposta atrasada', async () => {
    const a = deferred<string>();
    const b = deferred<string>();
    const signals: AbortSignal[] = [];
    const { result, rerender } = await renderHook(
      ({ k }: { k: string }) =>
        useRemote(k, (signal) => {
          signals.push(signal);
          return k === 'A' ? a.promise : b.promise;
        }),
      { initialProps: { k: 'A' } },
    );

    await rerender({ k: 'B' });
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await act(async () => b.resolve('b'));
    await act(async () => a.resolve('a'));

    expect(result.current.data).toBe('b');
    expect(result.current.loading).toBe(false);
  });

  it('desmontar cancela a busca em andamento', async () => {
    const d = deferred<string>();
    let signal: AbortSignal | undefined;
    const { unmount } = await renderHook(() =>
      useRemote('k', (s) => {
        signal = s;
        return d.promise;
      }),
    );
    expect(signal?.aborted).toBe(false);

    await unmount();

    expect(signal?.aborted).toBe(true);
    await act(async () => d.resolve('tarde')); // não deve estourar nem atualizar nada
  });

  it('reload busca de novo e mantém o dado anterior enquanto carrega', async () => {
    const second = deferred<string>();
    let calls = 0;
    const { result } = await renderHook(() =>
      useRemote('k', () => (++calls === 1 ? Promise.resolve('a') : second.promise)),
    );
    await waitFor(() => expect(result.current.data).toBe('a'));

    await act(async () => result.current.reload());
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe('a');

    await act(async () => second.resolve('b'));
    expect(result.current.data).toBe('b');
    expect(result.current.loading).toBe(false);
  });

  it('um reload superado por outro não encerra o loading cedo', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const queue = [Promise.resolve('x'), first.promise, second.promise];
    let i = 0;
    const { result } = await renderHook(() => useRemote('k', () => queue[i++] ?? Promise.resolve('?')));
    await waitFor(() => expect(result.current.data).toBe('x'));

    await act(async () => {
      result.current.reload();
      result.current.reload();
    });
    await act(async () => first.resolve('velho'));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe('x');

    await act(async () => second.resolve('novo'));
    expect(result.current.data).toBe('novo');
    expect(result.current.loading).toBe(false);
  });

  it('erro: expõe a mensagem, sem dado, e reload se recupera', async () => {
    const failing = deferred<string>();
    let calls = 0;
    const { result } = await renderHook(() => useRemote('k', () => (++calls === 1 ? failing.promise : Promise.resolve('ok'))));

    await act(async () => failing.reject(new Error('boom')));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual(expect.any(String));
    expect(result.current.error).not.toBe('');
    expect(result.current.errorStatus).toBeNull();

    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe('ok'));
    expect(result.current.error).toBeNull();
  });

  it('erro HTTP: expõe o status', async () => {
    const notFound = { isAxiosError: true, response: { status: 404, data: { message: 'Turma não encontrada.' } } };
    const { result } = await renderHook(() => useRemote('k', () => Promise.reject(notFound)));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Turma não encontrada.');
    expect(result.current.errorStatus).toBe(404);
  });
});
