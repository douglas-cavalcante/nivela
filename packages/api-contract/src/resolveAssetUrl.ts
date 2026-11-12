/** `esquema://host[:porta]` do início de uma URL absoluta. */
const ORIGIN = /^[a-z][a-z\d+.-]*:\/\/[^/?#]+/i;
/** Já tem esquema (`https:`, `blob:`, `data:`...): não mexe. */
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;

/**
 * URL absoluta de um arquivo servido pela API (ex.: `image_url` das questões,
 * que vem relativo à raiz: `/uploads/questions/<arquivo>`).
 *
 * Usa só a origem de `apiBaseUrl` (`http://10.0.2.2:8000/api/v1` →
 * `http://10.0.2.2:8000`), então funciona no emulador, no celular e no web
 * com o mesmo endereço já configurado para a API. URLs que já são absolutas
 * passam direto; base relativa (proxy no mesmo host) devolve o caminho.
 */
export function resolveAssetUrl(apiBaseUrl: string, path: string | null): string | null {
  if (path === null) {
    return null;
  }
  if (HAS_SCHEME.test(path)) {
    return path;
  }
  const rooted = path.startsWith('/') ? path : `/${path}`;
  const origin = ORIGIN.exec(apiBaseUrl.trim())?.[0] ?? '';
  return `${origin}${rooted}`;
}
