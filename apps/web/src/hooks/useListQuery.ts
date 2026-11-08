import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Estado de uma listagem na query string (`?page=2&search=fra&subject_id=3`):
 * dá para recarregar, voltar e compartilhar o link. Parâmetros que o hook não
 * conhece são preservados; valores iguais ao padrão não aparecem na URL
 * (um filtro vazio com padrão não vazio vira `?chave=`).
 */
export function useListQuery<F extends Record<string, string>>(defaultValues: F) {
  // `defaultValues` costuma ser um literal novo a cada render; o que importa é o conteúdo
  const defaultsKey = JSON.stringify(defaultValues);
  const defaults = useMemo(() => JSON.parse(defaultsKey) as F, [defaultsKey]);
  const [searchParams, setSearchParams] = useSearchParams();

  const rawPage = Number(searchParams.get('page'));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

  const filters = useMemo(() => {
    const current: Record<string, string> = {};
    for (const key of Object.keys(defaults)) current[key] = searchParams.has(key) ? (searchParams.get(key) ?? '') : defaults[key];
    return current as F;
  }, [searchParams, defaults]);

  const setPage = useCallback(
    (next: number) => {
      setSearchParams((previous) => {
        const params = new URLSearchParams(previous);
        if (next <= 1) params.delete('page');
        else params.set('page', String(next));
        return params;
      });
    },
    [setSearchParams],
  );

  const setFilter = useCallback(
    <K extends keyof F>(key: K, value: F[K]) => {
      setSearchParams((previous) => {
        const params = new URLSearchParams(previous);
        // só o valor padrão sai da URL: "vazio" com padrão não vazio precisa de `?chave=`
        if (value === defaults[key]) params.delete(key as string);
        else params.set(key as string, value);
        params.delete('page'); // outro filtro, outra lista: volta para a primeira página
        return params;
      });
    },
    [setSearchParams, defaults],
  );

  return { page, filters, setPage, setFilter };
}
