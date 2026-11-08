import { Module } from '@nestjs/common';
import { JoinCodeService } from 'src/modules/classrooms/join-code.service';

@Module({
  providers: [JoinCodeService],
  exports: [JoinCodeService],
})
export class ClassroomsModule {}
