import { act, render, screen } from '@testing-library/react-native';
import type { InternalAxiosRequestConfig } from 'axios';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { AuthProvider, useAuth } from 'src/lib/auth/AuthContext';
import type { AuthContextValue } from 'src/lib/auth/AuthContext';
import { getToken, setToken } from 'src/lib/auth/tokenStorage';
import api from 'src/lib/axios';
import { student } from 'src/test/users';

const other = { ...student, id: 2, name: 'Bia Lima' };

// Guarda o valor do contexto para o teste chamar signIn/signOut mesmo durante o carregamento.
let auth: AuthContextValue;

function Probe() {
  const value = useAuth();
  useEffect(() => {
    auth = value;
  });
  const { user, loading } = value;
  return <Text>{loading ? 'carregando' : user ? `logado:${user.name}` : 'deslogado'}</Text>;
}

/** API falsa em que o GET /auth/me só responde quando `gate` for liberado. */
function fakeApi(gate: Promise<void>) {
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    if (config.url === '/auth/me') {
      await gate;
      return { data: { user: student }, status: 200, statusText: 'OK', headers: {}, config };
    }
    if (config.url === '/auth/logout') {
      return { data: null, status: 204, statusText: 'No Content', headers: {}, config };
    }
    throw new Error(`Requisição inesperada: ${config.url}`);
  };
}

const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

function pendingBoot() {
  let release: () => void = () => undefined;
  fakeApi(new Promise<void>((resolve) => (release = resolve)));
  return () => release();
}

describe('AuthProvider', () => {
  it('signIn durante o boot: o /auth/me atrasado não sobrescreve o usuário', async () => {
    const release = pendingBoot();
    await setToken('velho');
    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await flush();

    await act(() => auth.signIn('novo', other));
    expect(await screen.findByText('logado:Bia Lima')).toBeTruthy();

    release();
    await flush();

    expect(screen.getByText('logado:Bia Lima')).toBeTruthy();
    expect(await getToken()).toBe('novo');
  });

  it('signOut durante o boot: o /auth/me atrasado não traz o usuário de volta', async () => {
    const release = pendingBoot();
    await setToken('velho');
    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await flush();

    await act(() => auth.signOut());
    expect(await screen.findByText('deslogado')).toBeTruthy();

    release();
    await flush();

    expect(screen.getByText('deslogado')).toBeTruthy();
    expect(await getToken()).toBeNull();
  });
});
