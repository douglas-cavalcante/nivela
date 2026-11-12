import { Module } from '@nestjs/common';
import {
  MeCoinsController,
  StudentCoinsController,
} from 'src/modules/dashboard/coins.controller';
import { CoinsService } from 'src/modules/dashboard/coins.service';
import {
  DashboardController,
  PerformanceController,
} from 'src/modules/dashboard/dashboard.controller';
import { DashboardService } from 'src/modules/dashboard/dashboard.service';
import { PerformanceService } from 'src/modules/dashboard/performance.service';
import { QuestionsModule } from 'src/modules/questions/questions.module';

/** Indicadores, desempenho por categoria e extrato de moedas. */
@Module({
  imports: [QuestionsModule],
  controllers: [
    DashboardController,
    PerformanceController,
    StudentCoinsController,
    MeCoinsController,
  ],
  providers: [DashboardService, PerformanceService, CoinsService],
})
export class DashboardModule {}
