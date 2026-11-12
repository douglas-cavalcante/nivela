import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clearToken, getToken, setToken } from 'src/lib/auth/tokenStorage';
import api, { setUnauthorizedHandler } from 'src/lib/axios';
import type { ApiUser as User } from '@nivela/api-contract';

export interface AuthContextValue {
  user: User | null;
  /** Verdadeiro enquanto o token salvo está sendo validado em GET /auth/me. */
  loading: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => getToken() !== null);

  // 401 em qualquer requisição autenticada: o interceptor já limpou o token.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  // Requisição de boot em andamento; `signIn`/`signOut` a marcam como obsoleta para
  // que um /auth/me atrasado não sobrescreva o que a pessoa acabou de fazer.
  const boot = useRef<{ cancelled: boolean } | null>(null);

  // Boot: se há token salvo, recupera o usuário.
  useEffect(() => {
    if (getToken() === null) return;
    const request = { cancelled: false };
    boot.current = request;
    api
      .get<{ user: User }>('/auth/me')
      .then(({ data }) => {
        if (!request.cancelled) setUser(data.user);
      })
      .catch(() => {
        // 401 já limpou o token no interceptor; outros erros deixam a pessoa no login
        if (!request.cancelled) setUser(null);
      })
      .finally(() => {
        if (!request.cancelled) setLoading(false);
      });
    return () => {
      request.cancelled = true;
    };
  }, []);

  const signIn = useCallback((token: string, nextUser: User) => {
    if (boot.current) boot.current.cancelled = true;
    setToken(token);
    setUser(nextUser);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    if (boot.current) boot.current.cancelled = true;
    setLoading(false);
    try {
      await api.post('/auth/logout');
    } catch {
      // mesmo sem resposta da API, a sessão local termina
    } finally {
      clearToken();
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth precisa estar dentro de AuthProvider.');
  return value;
}
