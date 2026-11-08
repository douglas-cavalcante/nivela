import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { AuthContext, AuthProvider } from 'src/lib/auth/AuthContext';
import type { AuthContextValue } from 'src/lib/auth/AuthContext';
import { ColorModeProvider } from 'src/lib/theme/ColorModeProvider';
import type { User } from 'src/types/user';

interface Options {
  /** Usuário já autenticado (padrão: ninguém). */
  user?: User | null;
  loading?: boolean;
  route?: string;
  auth?: Partial<AuthContextValue>;
  /** Usa o AuthProvider de verdade (token, /auth/me, signIn) em vez do contexto controlado. */
  realAuth?: boolean;
}

/** Renderiza com tema, roteador em memória e um AuthContext controlado pelo teste. */
export function renderWithProviders(
  ui: ReactElement,
  { user = null, loading = false, route = '/', auth, realAuth = false }: Options = {},
): RenderResult & { auth: AuthContextValue } {
  const value: AuthContextValue = {
    user,
    loading,
    signIn: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...auth,
  };
  const router = <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>;
  const result = render(
    <ColorModeProvider>
      {realAuth ? (
        <AuthProvider>{router}</AuthProvider>
      ) : (
        <AuthContext.Provider value={value}>{router}</AuthContext.Provider>
      )}
    </ColorModeProvider>,
  );
  return Object.assign(result, { auth: value });
}
