import { Module } from '@nestjs/common';
import { StudentsController } from 'src/modules/students/students.controller';
import { StudentsService } from 'src/modules/students/students.service';
import { StudyModule } from 'src/shared/study/study.module';

@Module({
  imports: [StudyModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
