import { Global, Module } from '@nestjs/common';
import { CLOCK, systemClock } from 'src/shared/clock/clock';

/** Relógio único da aplicação (global); os testes o trocam por um relógio fixo. */
@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: systemClock }],
  exports: [CLOCK],
})
export class ClockModule {}
