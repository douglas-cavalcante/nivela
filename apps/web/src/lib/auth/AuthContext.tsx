import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { clearToken, getToken, setToken } from 'src/lib/auth/tokenStorage';
import api, { setUnauthorizedHandler } from 'src/lib/axios';
import type { User } from 'src/types/user';

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

  // Boot: se há token salvo, recupera o usuário.
  useEffect(() => {
    if (getToken() === null) return;
    let cancelled = false;
    api
      .get<{ user: User }>('/auth/me')
      .then(({ data }) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        // 401 já limpou o token no interceptor; outros erros deixam a pessoa no login
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((token: string, nextUser: User) => {
    setToken(token);
    setUser(nextUser);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
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
