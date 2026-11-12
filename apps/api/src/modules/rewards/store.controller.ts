import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  ApiList,
  ApiMyRedemption,
  ApiRedeemResult,
  ApiStoreReward,
  Paginated,
} from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';
import { ListMyRedemptionsQuery } from 'src/modules/rewards/dto/list-my-redemptions.query';
import { RedemptionsService } from 'src/modules/rewards/redemptions.service';
import { RewardsService } from 'src/modules/rewards/rewards.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

/** Loja do aluno: vitrine, resgate e histórico de resgates. */
@ApiTags('store')
@ApiBearerAuth()
@Roles(Role.Student)
@Controller('store')
export class StoreController {
  constructor(
    private readonly rewards: RewardsService,
    private readonly redemptions: RedemptionsService,
  ) {}

  @Get('rewards')
  list(@CurrentUser() user: AuthUser): Promise<ApiList<ApiStoreReward>> {
    return this.rewards.storeList(user);
  }

  @Post('rewards/:id/redeem')
  redeem(
    @Param('id', new ParseIdPipe('Prêmio não encontrado.')) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiRedeemResult> {
    return this.redemptions.redeem(user, id);
  }

  @Get('redemptions')
  listMine(
    @Query() query: ListMyRedemptionsQuery,
    @CurrentUser() user: AuthUser,
  ): Promise<Paginated<ApiMyRedemption>> {
    return this.redemptions.listMine(user, query);
  }
}
