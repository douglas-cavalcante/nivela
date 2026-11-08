import axios from 'axios';
import type { ApiErrorInfo } from './errors';

const NETWORK_MESSAGE = 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
const GENERIC_MESSAGE = 'Algo deu errado. Tente novamente em instantes.';

interface RawErrorBody {
  message?: unknown;
  errors?: unknown;
}

function readFieldErrors(errors: unknown): Record<string, string[]> {
  if (typeof errors !== 'object' || errors === null) return {};
  const result: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(errors)) {
    if (Array.isArray(messages)) {
      const texts = messages.filter((item): item is string => typeof item === 'string');
      if (texts.length > 0) result[field] = texts;
    }
  }
  return result;
}

/** Converte qualquer erro de requisição no formato da API (`message` + `errors`). */
export function parseApiError(error: unknown): ApiErrorInfo {
  if (!axios.isAxiosError(error)) return { status: null, message: GENERIC_MESSAGE, fieldErrors: {} };
  if (!error.response) return { status: null, message: NETWORK_MESSAGE, fieldErrors: {} };

  const body: RawErrorBody =
    typeof error.response.data === 'object' && error.response.data !== null ? error.response.data : {};
  const fieldErrors = readFieldErrors(body.errors);
  const message = typeof body.message === 'string' && body.message.length > 0 ? body.message : GENERIC_MESSAGE;
  return { status: error.response.status, message, fieldErrors };
}
