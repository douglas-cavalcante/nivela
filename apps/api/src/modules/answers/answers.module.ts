import { Module } from '@nestjs/common';
import { AnswersController } from 'src/modules/answers/answers.controller';
import { AnswersService } from 'src/modules/answers/answers.service';
import { MeStatsController } from 'src/modules/answers/me-stats.controller';
import { CLOCK, systemClock } from 'src/shared/clock/clock';
import { StudyModule } from 'src/shared/study/study.module';

@Module({
  imports: [StudyModule],
  controllers: [AnswersController, MeStatsController],
  providers: [AnswersService, { provide: CLOCK, useValue: systemClock }],
  exports: [AnswersService],
})
export class AnswersModule {}
