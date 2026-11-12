import { createContext, useContext } from 'react';

export type ChangeServerResult = 'ok' | 'invalid' | 'unreachable';

export interface ServerUrlContextValue {
  /** Endereço atual da API (com `/api/v1`). */
  url: string;
  /** Verdadeiro quando é o endereço padrão do app (`EXPO_PUBLIC_API_URL`). */
  isDefault: boolean;
  /**
   * Normaliza, testa `GET <url>/health` e só então salva. Ao salvar um endereço diferente do
   * atual, encerra a sessão: o token do servidor antigo nunca vai para o novo.
   */
  change: (input: string) => Promise<ChangeServerResult>;
  /** Volta ao endereço padrão (encerrando a sessão se ele for diferente do atual). */
  reset: () => Promise<void>;
}

export const ServerUrlContext = createContext<ServerUrlContextValue | null>(null);

export function useServerUrl(): ServerUrlContextValue {
  const value = useContext(ServerUrlContext);
  if (!value) throw new Error('useServerUrl precisa estar dentro de ServerUrlProvider.');
  return value;
}
