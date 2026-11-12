import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ApiRedemption, Paginated } from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';
import { ListRedemptionsQuery } from 'src/modules/rewards/dto/list-redemptions.query';
import { RejectRedemptionDto } from 'src/modules/rewards/dto/reject-redemption.dto';
import { RedemptionsService } from 'src/modules/rewards/redemptions.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

const redemptionId = () => new ParseIdPipe('Resgate não encontrado.');

/** Fila de resgates da equipe (professor e administrador). */
@ApiTags('redemptions')
@ApiBearerAuth()
@Roles(Role.Admin, Role.Teacher)
@Controller('redemptions')
export class RedemptionsController {
  constructor(private readonly redemptions: RedemptionsService) {}

  @Get()
  list(
    @Query() query: ListRedemptionsQuery,
    @CurrentUser() user: AuthUser,
  ): Promise<Paginated<ApiRedemption>> {
    return this.redemptions.list(query, user);
  }

  @Post(':id/deliver')
  @HttpCode(200)
  deliver(
    @Param('id', redemptionId()) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiRedemption> {
    return this.redemptions.deliver(id, user);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @Param('id', redemptionId()) id: number,
    @Body() dto: RejectRedemptionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiRedemption> {
    return this.redemptions.reject(id, dto, user);
  }
}
