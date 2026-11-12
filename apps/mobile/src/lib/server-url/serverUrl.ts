import * as SecureStore from 'expo-secure-store';

const KEY = 'nivela.serverUrl';
const DEFAULT_PATH = '/api/v1';

/**
 * Transforma o que a pessoa digitou no endereço da API: sem esquema vira `http://`, só aceita
 * `http:`/`https:`, tira a `/` final e, sem caminho, acrescenta `/api/v1`. Inválido → `null`.
 * (Sem `new URL`: o parser do React Native não cobre host, porta e caminho de forma confiável.)
 */
export function normalizeServerUrl(input: string): string | null {
  const text = input.trim();
  if (text === '' || /\s/.test(text)) return null;

  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(text)?.[1].toLowerCase();
  if (scheme !== undefined && scheme !== 'http' && scheme !== 'https') return null;
  const withScheme = scheme === undefined ? `http://${text}` : text;

  const match = /^(https?):\/\/([^/?#]+)(\/[^?#]*)?$/i.exec(withScheme);
  if (!match) return null;
  const [, protocol, host, path = ''] = match;
  if (!/^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host)) return null;

  const cleanPath = path.replace(/\/+$/, '');
  return `${protocol.toLowerCase()}://${host}${cleanPath === '' ? DEFAULT_PATH : cleanPath}`;
}

/** Texto curto para a tela: sem `http(s)://` e sem o `/api/v1` final. */
export function formatServerUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/api\/v1\/?$/, '');
}

export async function getStoredServerUrl(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setStoredServerUrl(url: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, url);
  } catch {
    // sem armazenamento seguro, o endereço vale só até fechar o app
  }
}

export async function clearStoredServerUrl(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // nada a limpar
  }
}
