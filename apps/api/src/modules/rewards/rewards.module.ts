import { Module } from '@nestjs/common';
import { RewardImageService } from 'src/modules/rewards/reward-image.service';
import { RewardsController } from 'src/modules/rewards/rewards.controller';
import { RewardsService } from 'src/modules/rewards/rewards.service';
import { StoreController } from 'src/modules/rewards/store.controller';
import { FilesModule } from 'src/shared/files/files.module';

@Module({
  imports: [FilesModule],
  controllers: [RewardsController, StoreController],
  providers: [RewardsService, RewardImageService],
  exports: [RewardsService],
})
export class RewardsModule {}
