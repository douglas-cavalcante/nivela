import { Module } from '@nestjs/common';
import { AnswersController } from 'src/modules/answers/answers.controller';
import { AnswersService } from 'src/modules/answers/answers.service';
import { MeStatsController } from 'src/modules/answers/me-stats.controller';
import { PracticeController } from 'src/modules/answers/practice.controller';
import { PracticeService } from 'src/modules/answers/practice.service';
import { QuestionsModule } from 'src/modules/questions/questions.module';
import { CLOCK, systemClock } from 'src/shared/clock/clock';
import { StudyModule } from 'src/shared/study/study.module';

@Module({
  imports: [StudyModule, QuestionsModule],
  controllers: [AnswersController, PracticeController, MeStatsController],
  providers: [
    AnswersService,
    PracticeService,
    { provide: CLOCK, useValue: systemClock },
  ],
  exports: [AnswersService],
})
export class AnswersModule {}
