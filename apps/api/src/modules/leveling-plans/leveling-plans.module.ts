import { Module } from '@nestjs/common';
import { AssignmentsService } from 'src/modules/leveling-plans/assignments.service';
import { ChaptersService } from 'src/modules/leveling-plans/chapters.service';
import { PlanProgressService } from 'src/modules/leveling-plans/plan-progress.service';
import { PlansController } from 'src/modules/leveling-plans/plans.controller';
import { StudentPlansController } from 'src/modules/leveling-plans/student-plans.controller';
import { PlansService } from 'src/modules/leveling-plans/plans.service';

@Module({
  controllers: [PlansController, StudentPlansController],
  providers: [
    PlansService,
    ChaptersService,
    AssignmentsService,
    PlanProgressService,
  ],
  exports: [PlansService],
})
export class LevelingPlansModule {}
