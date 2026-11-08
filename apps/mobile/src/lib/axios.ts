import axios from 'axios';
import { clearToken, getToken } from 'src/lib/auth/tokenStorage';

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

/** O AuthContext registra aqui o que fazer quando a sessão expira (ou `null` para remover). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

// Último token cujo 401 já foi tratado. Como o armazenamento é assíncrono, duas respostas 401
// em paralelo poderiam ler o mesmo token antes de ele ser limpo; marcar aqui, de forma
// síncrona, garante um único aviso por sessão.
let handledToken: string | null = null;

// Sessão expirada/revogada: limpa o token e avisa uma única vez por sessão.
// Só vale se o 401 veio de uma requisição feita com o token ainda atual; assim, as
// demais respostas 401 em paralelo, o 401 de um login com senha errada (sem token) e o de
// uma requisição antiga (token já trocado) não disparam o aviso, evitando loops.
api.interceptors.response.use(undefined, async (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    const sent = String(error.config?.headers?.get('Authorization') ?? '').replace(/^Bearer /, '');
    if (sent && sent !== handledToken) {
      handledToken = sent;
      if ((await getToken()) === sent) {
        await clearToken();
        onUnauthorized?.();
      }
    }
  }
  return Promise.reject(error);
});

export default api;
