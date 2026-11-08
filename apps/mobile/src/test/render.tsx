import { renderRouter } from 'expo-router/testing-library';
import { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { setToken } from 'src/lib/auth/tokenStorage';
import api from 'src/lib/axios';
import type { ApiUser as User } from '@nivela/api-contract';

/** Resposta falsa da API: status 2xx resolve; os demais rejeitam como o axios real faria. */
export interface FakeReply {
  status: number;
  data?: unknown;
}

/** Quem responde a uma rota (`'POST /auth/login'`); recebe o corpo JSON já lido. */
export type FakeHandler = (body: Record<string, unknown>, config: InternalAxiosRequestConfig) => FakeReply | Promise<FakeReply>;

interface Options {
  /** Sessão salva: com usuário, o app abre logado (GET /auth/me responde com ele); sem, abre deslogado. */
  user?: User | null;
  initialUrl?: string;
  /** Respostas por `'MÉTODO /rota'`; o que não estiver aqui (nem for o /auth/me) falha o teste. */
  routes?: Record<string, FakeHandler>;
}

/** Rota que falha sem resposta, como sem internet ou com a API fora do ar. */
export const networkError: FakeHandler = (_body, config) => {
  throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
};

function toResponse(reply: FakeReply, config: InternalAxiosRequestConfig): AxiosResponse {
  return { data: reply.data ?? null, status: reply.status, statusText: '', headers: {}, config };
}

function readBody(config: InternalAxiosRequestConfig): Record<string, unknown> {
  return typeof config.data === 'string' && config.data.length > 0 ? JSON.parse(config.data) : {};
}

/** Renderiza o app inteiro (pasta `app/`) com a API falsa. */
export async function renderApp({ user = null, initialUrl = '/', routes = {} }: Options = {}) {
  if (user) await setToken('token-de-teste');
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const key = `${config.method?.toUpperCase()} ${config.url}`;
    const handler = routes[key];
    if (handler) {
      const reply = await handler(readBody(config), config);
      const response = toResponse(reply, config);
      if (reply.status >= 400) {
        throw new AxiosError(`Request failed with status code ${reply.status}`, 'ERR_BAD_REQUEST', config, null, response);
      }
      return response;
    }
    if (user && key === 'GET /auth/me') return toResponse({ status: 200, data: { user } }, config);
    throw new Error(`Requisição inesperada: ${key}`);
  };
  return renderRouter('app', { initialUrl });
}

