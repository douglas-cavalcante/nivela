import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ApiList, ApiStoreReward } from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RewardsService } from 'src/modules/rewards/rewards.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

/** Loja do aluno: vitrine de prêmios (os resgates entram aqui depois). */
@ApiTags('store')
@ApiBearerAuth()
@Roles(Role.Student)
@Controller('store')
export class StoreController {
  constructor(private readonly rewards: RewardsService) {}

  @Get('rewards')
  list(@CurrentUser() user: AuthUser): Promise<ApiList<ApiStoreReward>> {
    return this.rewards.storeList(user);
  }
}
