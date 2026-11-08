import { useCallback, useEffect, useRef, useState } from 'react';
import { parseApiError } from '@nivela/api-contract';

interface Snapshot<T> {
  rows: T[];
  error: string | null;
  /** Status HTTP do erro (`null` sem erro ou sem resposta). */
  errorStatus: number | null;
  /** Chave da busca que produziu este resultado. */
  key: string;
}

/**
 * Carrega uma lista não paginada ao montar e sempre que `key` muda; `reload` busca de novo.
 * Uma busca nova (ou desmontar) cancela a anterior pelo `signal` e descarta a resposta atrasada.
 */
export function useRemoteList<T>(load: (signal: AbortSignal) => Promise<T[]>, key = '') {
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

  const fetchList = useCallback(async (forKey: string) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const id = ++requestId.current;
    let result: Snapshot<T>;
    try {
      result = { rows: await loadRef.current(current.signal), error: null, errorStatus: null, key: forKey };
    } catch (err) {
      const info = parseApiError(err);
      result = { rows: [], error: info.message, errorStatus: info.status, key: forKey };
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
    void fetchList(key);
    return cancel;
  }, [fetchList, cancel, key]);

  const reload = useCallback(async () => {
    setRefreshing(true);
    await fetchList(keyRef.current);
  }, [fetchList]);

  const loading = refreshing || snapshot === null || snapshot.key !== key;
  const current = snapshot && snapshot.key === key ? snapshot : null;
  return {
    rows: snapshot?.rows ?? [],
    loading,
    error: current?.error ?? null,
    errorStatus: current?.errorStatus ?? null,
    reload,
  };
}
