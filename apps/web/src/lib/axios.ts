import axios from 'axios';
import { clearToken, getToken } from 'src/lib/auth/tokenStorage';

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

/** O AuthContext registra aqui o que fazer quando a sessão expira (ou `null` para remover). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

/** Falha logo na inicialização, com mensagem clara, se a URL da API não estiver configurada. */
export function requireApiUrl(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(
      'VITE_API_URL não está definida. Copie apps/web/.env.example para apps/web/.env e reinicie o Vite (npm run dev:web).',
    );
  }
  return value;
}

const api = axios.create({
  baseURL: requireApiUrl(import.meta.env.VITE_API_URL),
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

// Sessão expirada/revogada: limpa o token e avisa uma única vez por sessão.
// Só vale se o 401 veio de uma requisição feita com o token ainda atual; assim, as
// demais respostas 401 em paralelo (token já limpo) e o 401 de um login com senha
// errada (sem token) não disparam o aviso, evitando loops de redirecionamento.
api.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    const sent = String(error.config?.headers?.get('Authorization') ?? '');
    const current = getToken();
    if (current && sent === `Bearer ${current}`) {
      clearToken();
      onUnauthorized?.();
    }
  }
  return Promise.reject(error);
});

export default api;
