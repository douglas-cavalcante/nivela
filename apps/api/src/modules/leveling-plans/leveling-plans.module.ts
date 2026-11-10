import { Module } from '@nestjs/common';
import { AssignmentsService } from 'src/modules/leveling-plans/assignments.service';
import { ChaptersService } from 'src/modules/leveling-plans/chapters.service';
import { PlansController } from 'src/modules/leveling-plans/plans.controller';
import { PlansService } from 'src/modules/leveling-plans/plans.service';

@Module({
  controllers: [PlansController],
  providers: [PlansService, ChaptersService, AssignmentsService],
  exports: [PlansService],
})
export class LevelingPlansModule {}
