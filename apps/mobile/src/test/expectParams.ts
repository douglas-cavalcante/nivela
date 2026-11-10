import type { InternalAxiosRequestConfig } from 'axios';

function defined(params: Record<string, unknown> | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries(params ?? {}).filter(([, value]) => value !== undefined));
}

/**
 * Afirma que a requisição saiu com exatamente estes `params` (chaves `undefined` são ignoradas).
 * Use dentro de um handler do fake: `(_body, config) => { expectParams(config, { page: 1 }); ... }`.
 */
export function expectParams(config: InternalAxiosRequestConfig, expected: Record<string, unknown>): void {
  const actual = defined(config.params as Record<string, unknown> | undefined);
  const wanted = defined(expected);
  try {
    expect(actual).toEqual(wanted);
  } catch {
    throw new Error(
      `Parâmetros inesperados em ${config.method?.toUpperCase()} ${config.url}.\nEsperado: ${JSON.stringify(wanted)}\nRecebido: ${JSON.stringify(actual)}`,
    );
  }
}
