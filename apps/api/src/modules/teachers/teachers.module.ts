import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { TeachersController } from 'src/modules/teachers/teachers.controller';
import { TeachersService } from 'src/modules/teachers/teachers.service';

@Module({
  imports: [AuthModule],
  controllers: [TeachersController],
  providers: [TeachersService],
})
export class TeachersModule {}
