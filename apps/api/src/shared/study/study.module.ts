import { Module } from '@nestjs/common';
import { CoinLedger } from 'src/shared/coins/coin-ledger';

/** Serviços compartilhados de estudo, usados pelas features de respostas e planos. */
@Module({
  providers: [CoinLedger],
  exports: [CoinLedger],
})
export class StudyModule {}
