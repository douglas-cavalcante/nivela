import { renderRouter } from 'expo-router/testing-library';
import type { InternalAxiosRequestConfig } from 'axios';
import { setToken } from 'src/lib/auth/tokenStorage';
import api from 'src/lib/axios';
import type { User } from 'src/types/user';

interface Options {
  /** Sessão salva: com usuário, o app abre logado (GET /auth/me responde com ele); sem, abre deslogado. */
  user?: User | null;
  initialUrl?: string;
}

/** Renderiza o app inteiro (pasta `app/`) com a API falsa respondendo `/auth/me`. */
export async function renderApp({ user = null, initialUrl = '/' }: Options = {}) {
  if (user) await setToken('token-de-teste');
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    if (user && config.url === '/auth/me') {
      return { data: { user }, status: 200, statusText: 'OK', headers: {}, config };
    }
    throw new Error(`Requisição inesperada: ${config.method} ${config.url}`);
  };
  return renderRouter('app', { initialUrl });
}
