const DEFAULT_LOGIN_LIMIT = 10;
const DEFAULT_REGISTER_LIMIT = 30;
const DEFAULT_TTL_SECONDS = 60;

/** Mensagem do 429 nas rotas públicas de autenticação. */
export const THROTTLE_MESSAGE =
  'Muitas tentativas. Aguarde um minuto e tente de novo.';

/** Inteiro positivo lido da variável de ambiente; qualquer outra coisa cai no padrão. */
function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw || !/^\d+$/.test(raw)) {
    return fallback;
  }
  const value = Number(raw);
  return value > 0 ? value : fallback;
}

/** Tentativas de login por janela, para cada par ip + e-mail (`THROTTLE_LOGIN_LIMIT`). */
export function loginLimit(): number {
  return positiveInt('THROTTLE_LOGIN_LIMIT', DEFAULT_LOGIN_LIMIT);
}

/** Cadastros por janela, para cada ip (`THROTTLE_REGISTER_LIMIT`). */
export function registerLimit(): number {
  return positiveInt('THROTTLE_REGISTER_LIMIT', DEFAULT_REGISTER_LIMIT);
}

/** Janela em milissegundos (`THROTTLE_TTL_SECONDS`, em segundos). */
export function throttleTtlMs(): number {
  return positiveInt('THROTTLE_TTL_SECONDS', DEFAULT_TTL_SECONDS) * 1000;
}
