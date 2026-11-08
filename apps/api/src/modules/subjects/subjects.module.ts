import { Module } from '@nestjs/common';
import { SubjectsController } from 'src/modules/subjects/subjects.controller';
import { SubjectsService } from 'src/modules/subjects/subjects.service';

@Module({
  controllers: [SubjectsController],
  providers: [SubjectsService],
  exports: [SubjectsService],
})
export class SubjectsModule {}
