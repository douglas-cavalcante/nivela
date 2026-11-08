import type { Paginated, PaginationMeta } from '@nivela/api-contract';
import { useRemoteList } from 'src/hooks/useRemoteList';

/**
 * Como `useRemoteList`, para listagens paginadas (`Paginated<T>`): devolve também o `meta` da página.
 * Reaproveita a concorrência dali (busca nova cancela a anterior e descarta resposta atrasada);
 * a página inteira é tratada como um único item. Inclua página e filtros em `key`.
 */
export function usePaginatedList<T>(load: (signal: AbortSignal) => Promise<Paginated<T>>, key = '') {
  const { rows, loading, error, reload } = useRemoteList<Paginated<T>>(async (signal) => [await load(signal)], key);
  const page = rows[0];
  return {
    rows: page?.data ?? [],
    meta: page?.meta as PaginationMeta | undefined,
    loading,
    error,
    reload,
  };
}
