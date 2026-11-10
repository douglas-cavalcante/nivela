import { Module } from '@nestjs/common';
import { ChaptersService } from 'src/modules/leveling-plans/chapters.service';
import { PlansController } from 'src/modules/leveling-plans/plans.controller';
import { PlansService } from 'src/modules/leveling-plans/plans.service';

@Module({
  controllers: [PlansController],
  providers: [PlansService, ChaptersService],
  exports: [PlansService],
})
export class LevelingPlansModule {}
