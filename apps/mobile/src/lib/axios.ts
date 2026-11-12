import axios from 'axios';
import { clearToken, getToken } from 'src/lib/auth/tokenStorage';

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

/** O AuthContext registra aqui o que fazer quando a sessão expira (ou `null` para remover). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

/** Sessão encerrada fora de uma resposta 401 (ex.: troca de servidor): avisa o AuthContext. */
export function notifySessionEnded(): void {
  onUnauthorized?.();
}

/** Falha logo na inicialização, com mensagem clara, se a URL da API não estiver configurada. */
export function requireApiUrl(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(
      'EXPO_PUBLIC_API_URL não está definida. Copie apps/mobile/.env.example para apps/mobile/.env e reinicie o Expo (npm run dev:mobile).',
    );
  }
  return value;
}

/** Endereço atual da API; o ServerUrlProvider o define ao abrir o app e quando a pessoa o troca. */
let currentBaseUrl: string | null = null;

export function setApiBaseUrl(url: string): void {
  currentBaseUrl = url;
}

/** Endereço atual da API; sem nenhum definido, vale o padrão (`EXPO_PUBLIC_API_URL`, validado). */
export function getApiBaseUrl(): string {
  return currentBaseUrl ?? requireApiUrl(process.env.EXPO_PUBLIC_API_URL);
}

const api = axios.create({
  // Sem resposta em 15 s, a requisição falha (ERR_TIMEOUT) em vez de prender a tela.
  timeout: 15000,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use(async (config) => {
  // `baseURL` explícito na requisição (teste de conexão com um endereço ainda não confiável):
  // vai exatamente para lá e sem o token da sessão.
  if (config.baseURL) return config;
  config.baseURL = getApiBaseUrl();
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
