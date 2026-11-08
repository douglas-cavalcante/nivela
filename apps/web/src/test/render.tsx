import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { AuthContext } from 'src/lib/auth/AuthContext';
import type { AuthContextValue } from 'src/lib/auth/AuthContext';
import { ColorModeProvider } from 'src/lib/theme/ColorModeProvider';
import type { User } from 'src/types/user';

interface Options {
  /** Usuário já autenticado (padrão: ninguém). */
  user?: User | null;
  loading?: boolean;
  route?: string;
  auth?: Partial<AuthContextValue>;
}

/** Renderiza com tema, roteador em memória e um AuthContext controlado pelo teste. */
export function renderWithProviders(
  ui: ReactElement,
  { user = null, loading = false, route = '/', auth }: Options = {},
): RenderResult & { auth: AuthContextValue } {
  const value: AuthContextValue = {
    user,
    loading,
    signIn: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...auth,
  };
  const result = render(
    <ColorModeProvider>
      <AuthContext.Provider value={value}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </ColorModeProvider>,
  );
  return Object.assign(result, { auth: value });
}
