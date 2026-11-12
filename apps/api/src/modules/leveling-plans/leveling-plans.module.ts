import { Module } from '@nestjs/common';
import { AssignmentsService } from 'src/modules/leveling-plans/assignments.service';
import { ChaptersService } from 'src/modules/leveling-plans/chapters.service';
import { MePlansController } from 'src/modules/leveling-plans/me-plans.controller';
import { PlanCompletionService } from 'src/modules/leveling-plans/plan-completion.service';
import { PlanProgressService } from 'src/modules/leveling-plans/plan-progress.service';
import { PlansController } from 'src/modules/leveling-plans/plans.controller';
import { StudentPlansController } from 'src/modules/leveling-plans/student-plans.controller';
import { PlansService } from 'src/modules/leveling-plans/plans.service';
import { StudentPlansService } from 'src/modules/leveling-plans/student-plans.service';
import { StudyModule } from 'src/shared/study/study.module';

@Module({
  imports: [StudyModule],
  controllers: [PlansController, StudentPlansController, MePlansController],
  providers: [
    PlansService,
    ChaptersService,
    AssignmentsService,
    PlanCompletionService,
    PlanProgressService,
    StudentPlansService,
  ],
  exports: [PlansService, StudentPlansService],
})
export class LevelingPlansModule {}
