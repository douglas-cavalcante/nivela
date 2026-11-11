import type { Clock } from 'src/shared/clock/clock';

/** Meio-dia em Fortaleza (15h UTC): longe da virada do dia de estudo. */
export const TEST_NOW = new Date('2026-11-10T15:00:00Z');

/**
 * Relógio fixo dos e2e (substitui o `CLOCK` em `createTestApp`): a sequência
 * de estudo e os prazos nunca dependem da hora real. Cada teste pode mudar o
 * instante com `set` e voltar ao padrão com `reset`.
 */
export class TestClock implements Clock {
  private current = TEST_NOW;

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(instant: Date | string): void {
    this.current = new Date(instant);
  }

  reset(): void {
    this.current = TEST_NOW;
  }
}
