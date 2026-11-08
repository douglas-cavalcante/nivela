import { Module } from '@nestjs/common';
import { ClassroomsController } from 'src/modules/classrooms/classrooms.controller';
import { StudentClassroomsController } from 'src/modules/classrooms/student-classrooms.controller';
import { ClassroomsService } from 'src/modules/classrooms/classrooms.service';
import { JoinCodeService } from 'src/modules/classrooms/join-code.service';
import { StudentsModule } from 'src/modules/students/students.module';

@Module({
  imports: [StudentsModule],
  controllers: [ClassroomsController, StudentClassroomsController],
  providers: [ClassroomsService, JoinCodeService],
  exports: [ClassroomsService, JoinCodeService],
})
export class ClassroomsModule {}
