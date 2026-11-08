import { createContext, useContext } from 'react';

export interface Notify {
  success(message: string): void;
  error(message: string): void;
}

export const NotifyContext = createContext<Notify | null>(null);

/** Avisos rápidos no rodapé: `notify.success('Salvo.')` / `notify.error('Não foi possível salvar.')`. */
export function useNotify(): Notify {
  const context = useContext(NotifyContext);
  if (!context) throw new Error('useNotify deve ser usado dentro de NotifyProvider');
  return context;
}
