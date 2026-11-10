import { parseApiError } from '@nivela/api-contract';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Snapshot<T> {
  data: T | null;
  error: string | null;
  /** Status HTTP do erro (`null` sem erro ou sem resposta). */
  errorStatus: number | null;
  /** Chave da busca que produziu este resultado. */
  key: string;
}

/**
 * Carrega um recurso ao montar e sempre que `key` muda; `reload` busca de novo.
 * Uma busca nova (ou desmontar) cancela a anterior pelo `signal` e descarta a resposta atrasada.
 * Mesmo contrato do `useRemoteList` da web, para um único valor.
 */
export function useRemote<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef(load);
  const keyRef = useRef(key);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    loadRef.current = load;
    keyRef.current = key;
  });

  const fetchData = useCallback(async (forKey: string) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const id = ++requestId.current;
    let result: Snapshot<T>;
    try {
      result = { data: await loadRef.current(current.signal), error: null, errorStatus: null, key: forKey };
    } catch (err) {
      const info = parseApiError(err);
      result = { data: null, error: info.message, errorStatus: info.status, key: forKey };
    }
    if (id !== requestId.current) return; // superada por uma busca mais nova (ela cuida do `refreshing`)
    setSnapshot(result);
    setRefreshing(false);
  }, []);

  const cancel = useCallback(() => {
    requestId.current++;
    controller.current?.abort();
  }, []);

  useEffect(() => {
    void fetchData(key);
    return cancel;
  }, [fetchData, cancel, key]);

  const reload = useCallback(() => {
    setRefreshing(true);
    void fetchData(keyRef.current);
  }, [fetchData]);

  const loading = refreshing || snapshot === null || snapshot.key !== key;
  // Mantém o dado anterior durante um reload; ao trocar a chave, o dado antigo some.
  const current = snapshot && snapshot.key === key ? snapshot : null;
  return {
    data: current?.data ?? null,
    loading,
    error: current?.error ?? null,
    errorStatus: current?.errorStatus ?? null,
    reload,
  };
}
