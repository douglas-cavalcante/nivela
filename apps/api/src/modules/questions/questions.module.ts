import { Module } from '@nestjs/common';
import { QuestionImageService } from 'src/modules/questions/question-image.service';
import { QuestionsController } from 'src/modules/questions/questions.controller';
import { QuestionsService } from 'src/modules/questions/questions.service';

@Module({
  controllers: [QuestionsController],
  providers: [QuestionsService, QuestionImageService],
  exports: [QuestionImageService],
})
export class QuestionsModule {}
