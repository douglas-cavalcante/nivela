import { Module } from '@nestjs/common';
import { CoinLedger } from 'src/shared/coins/coin-ledger';
import { StreakService } from 'src/shared/study/streak.service';

/** Serviços compartilhados de estudo, usados pelas features de respostas e planos. */
@Module({
  providers: [CoinLedger, StreakService],
  exports: [CoinLedger, StreakService],
})
export class StudyModule {}
