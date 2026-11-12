import { Module } from '@nestjs/common';
import { RewardImageService } from 'src/modules/rewards/reward-image.service';
import { RedemptionsController } from 'src/modules/rewards/redemptions.controller';
import { RedemptionsService } from 'src/modules/rewards/redemptions.service';
import { RewardsController } from 'src/modules/rewards/rewards.controller';
import { RewardsService } from 'src/modules/rewards/rewards.service';
import { StoreController } from 'src/modules/rewards/store.controller';
import { FilesModule } from 'src/shared/files/files.module';
import { StudyModule } from 'src/shared/study/study.module';

@Module({
  imports: [FilesModule, StudyModule],
  controllers: [RewardsController, RedemptionsController, StoreController],
  providers: [RewardsService, RedemptionsService, RewardImageService],
  exports: [RewardsService],
})
export class RewardsModule {}
