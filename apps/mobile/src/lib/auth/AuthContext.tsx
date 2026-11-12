import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clearToken, getToken, setToken } from 'src/lib/auth/tokenStorage';
import api, { setUnauthorizedHandler } from 'src/lib/axios';
import type { ApiUser as User } from '@nivela/api-contract';

export interface AuthContextValue {
  user: User | null;
  /** Verdadeiro enquanto o token salvo está sendo lido e validado em GET /auth/me. */
  loading: boolean;
  /**
   * Verdadeiro quando há sessão salva mas a API não respondeu (rede, tempo esgotado ou 5xx).
   * O token é mantido; `retry` refaz a checagem.
   */
  offline: boolean;
  /** Status HTTP da falha de boot (`null` quando a API nem respondeu); só vale com `offline`. */
  offlineStatus: number | null;
  /** Verdadeiro enquanto `retry` aguarda a resposta da API. */
  retrying: boolean;
  retry: () => void;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

type BootRequest = { cancelled: boolean };

interface SessionCheck {
  user: User | null;
  offline: boolean;
  offlineStatus: number | null;
}

/**
 * Se há token salvo, recupera o usuário em GET /auth/me. Só o 401 encerra a sessão (o
 * interceptor já limpou o token); qualquer outra falha (sem resposta, 5xx, 403/404/429),
 * o token fica e o app mostra a tela de falha, com tentar de novo e sair.
 */
async function checkSession(): Promise<SessionCheck> {
  try {
    if ((await getToken()) === null) return { user: null, offline: false, offlineStatus: null };
    const { data } = await api.get<{ user: User }>('/auth/me');
    return { user: data.user, offline: false, offlineStatus: null };
  } catch (error) {
    const offline = axios.isAxiosError(error) && error.response?.status !== 401;
    const offlineStatus = axios.isAxiosError(error) ? (error.response?.status ?? null) : null;
    return { user: null, offline, offlineStatus };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [offline, setOffline] = useState<boolean>(false);
  const [offlineStatus, setOfflineStatus] = useState<number | null>(null);
  const [retrying, setRetrying] = useState<boolean>(false);

  // 401 em qualquer requisição autenticada: o interceptor já limpou o token.
  useEffect(() => {
    // Também limpa a tela de falha: a sessão terminou (401 ou troca de servidor), não há o que refazer.
    setUnauthorizedHandler(() => {
      setUser(null);
      setOffline(false);
      setOfflineStatus(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Checagem de boot em andamento; `signIn`/`signOut` a marcam como obsoleta para
  // que um /auth/me atrasado não sobrescreva o que a pessoa acabou de fazer.
  const boot = useRef<BootRequest | null>(null);

  // Inicia uma checagem da sessão salva, marcando a anterior como obsoleta.
  const startCheck = useCallback(() => {
    if (boot.current) boot.current.cancelled = true;
    const request: BootRequest = { cancelled: false };
    boot.current = request;
    void checkSession().then((result) => {
      if (request.cancelled) return;
      setUser(result.user);
      setOffline(result.offline);
      setOfflineStatus(result.offlineStatus);
      setLoading(false);
      setRetrying(false);
    });
    return request;
  }, []);

  useEffect(() => {
    const request = startCheck();
    return () => {
      request.cancelled = true;
    };
  }, [startCheck]);

  const retry = useCallback(() => {
    setRetrying(true);
    startCheck();
  }, [startCheck]);

  const signIn = useCallback(async (token: string, nextUser: User) => {
    if (boot.current) boot.current.cancelled = true;
    await setToken(token);
    setUser(nextUser);
    setOffline(false);
    setOfflineStatus(null);
    setRetrying(false);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    if (boot.current) boot.current.cancelled = true;
    setLoading(false);
    setOffline(false);
    setOfflineStatus(null);
    setRetrying(false);
    const started = await getToken();
    try {
      await api.post('/auth/logout');
    } catch {
      // mesmo sem resposta da API, a sessão local termina
    } finally {
      // O logout pode levar até 15 s; se, nesse tempo, outra sessão começou (outro token),
      // ela não é apagada.
      if ((await getToken()) === started) {
        await clearToken();
        setUser(null);
      }
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, offline, offlineStatus, retrying, retry, signIn, signOut }),
    [user, loading, offline, offlineStatus, retrying, retry, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth precisa estar dentro de AuthProvider.');
  return value;
}
