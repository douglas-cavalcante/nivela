import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import api, { requireApiUrl, setApiBaseUrl } from 'src/lib/axios';
import {
  clearStoredServerUrl,
  getStoredServerUrl,
  normalizeServerUrl,
  setStoredServerUrl,
} from 'src/lib/server-url/serverUrl';
import { ServerUrlContext } from 'src/lib/server-url/useServerUrl';
import type { ChangeServerResult, ServerUrlContextValue } from 'src/lib/server-url/useServerUrl';

/** Tempo máximo do teste de conexão: curto, para a tela não parecer travada. */
const HEALTH_TIMEOUT_MS = 5000;

/** `GET <url>/health` responde 2xx? (Sem token: o endereço ainda não é de confiança.) */
async function isReachable(url: string): Promise<boolean> {
  try {
    await api.get('/health', { baseURL: url, timeout: HEALTH_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

/**
 * Guarda o endereço da API: o salvo no aparelho ou, sem ele, o padrão do app. Não renderiza nada
 * até ler o armazenamento, para que nenhuma requisição saia para o endereço errado.
 */
export function ServerUrlProvider({ children }: { children: ReactNode }) {
  const defaultUrl = requireApiUrl(process.env.EXPO_PUBLIC_API_URL);
  const [url, setUrl] = useState<string | null>(null);
  const [stored, setStored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getStoredServerUrl().then((saved) => {
      if (cancelled) return;
      const next = saved ?? defaultUrl;
      setApiBaseUrl(next);
      setUrl(next);
      setStored(saved !== null);
    });
    return () => {
      cancelled = true;
    };
  }, [defaultUrl]);

  const change = useCallback(
    async (input: string): Promise<ChangeServerResult> => {
      const candidate = normalizeServerUrl(input);
      if (candidate === null) return 'invalid';
      if (!(await isReachable(candidate))) return 'unreachable';
      await setStoredServerUrl(candidate);
      setApiBaseUrl(candidate);
      setUrl(candidate);
      setStored(true);
      return 'ok';
    },
    [],
  );

  const reset = useCallback(async () => {
    await clearStoredServerUrl();
    setApiBaseUrl(defaultUrl);
    setUrl(defaultUrl);
    setStored(false);
  }, [defaultUrl]);

  const value = useMemo<ServerUrlContextValue | null>(
    () => (url === null ? null : { url, isDefault: !stored || url === defaultUrl, change, reset }),
    [url, stored, defaultUrl, change, reset],
  );

  if (value === null) return null;
  return <ServerUrlContext.Provider value={value}>{children}</ServerUrlContext.Provider>;
}
