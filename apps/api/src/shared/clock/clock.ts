/** Token de injeção do relógio: os testes trocam por um relógio fixo. */
export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
