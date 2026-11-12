import { Module } from '@nestjs/common';
import { AnswersController } from 'src/modules/answers/answers.controller';
import { AnswersService } from 'src/modules/answers/answers.service';
import { MeStatsController } from 'src/modules/answers/me-stats.controller';
import { MeChapterController } from 'src/modules/answers/me-chapter.controller';
import { PracticeController } from 'src/modules/answers/practice.controller';
import { PracticeService } from 'src/modules/answers/practice.service';
import { LevelingPlansModule } from 'src/modules/leveling-plans/leveling-plans.module';
import { QuestionsModule } from 'src/modules/questions/questions.module';
import { StudyModule } from 'src/shared/study/study.module';

@Module({
  imports: [StudyModule, QuestionsModule, LevelingPlansModule],
  controllers: [
    AnswersController,
    PracticeController,
    MeStatsController,
    MeChapterController,
  ],
  providers: [AnswersService, PracticeService],
  exports: [AnswersService],
})
export class AnswersModule {}
