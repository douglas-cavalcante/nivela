import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type {
  ApiImageUpload,
  ApiReward,
  Paginated,
} from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';
import { ListRewardsQuery } from 'src/modules/rewards/dto/list-rewards.query';
import { RewardStatusDto } from 'src/modules/rewards/dto/reward-status.dto';
import { RewardDto } from 'src/modules/rewards/dto/reward.dto';
import { RewardsService } from 'src/modules/rewards/rewards.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';
import {
  HARD_UPLOAD_LIMIT_BYTES,
  type UploadedImage,
} from 'src/shared/files/image-storage.service';

const rewardId = () => new ParseIdPipe('Prêmio não encontrado.');

/** Catálogo de prêmios da escola, para professores e administradores. */
@ApiTags('rewards')
@ApiBearerAuth()
@Roles(Role.Admin, Role.Teacher)
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get()
  list(
    @Query() query: ListRewardsQuery,
    @CurrentUser() user: AuthUser,
  ): Promise<Paginated<ApiReward>> {
    return this.rewards.list(query, user);
  }

  @Post()
  create(
    @Body() dto: RewardDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiReward> {
    return this.rewards.create(dto, user);
  }

  @Get(':id')
  findOne(
    @Param('id', rewardId()) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiReward> {
    return this.rewards.findOne(id, user);
  }

  @Put(':id')
  update(
    @Param('id', rewardId()) id: number,
    @Body() dto: RewardDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiReward> {
    return this.rewards.update(id, dto, user);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id', rewardId()) id: number,
    @Body() dto: RewardStatusDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiReward> {
    return this.rewards.setStatus(id, dto.active, user);
  }

  /** Sem `storage`, o multer guarda o arquivo em memória: nada vai ao disco antes da validação. */
  @Post(':id/image')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: HARD_UPLOAD_LIMIT_BYTES,
        files: 1,
        fields: 5,
        parts: 6,
        fieldSize: 1024,
      },
    }),
  )
  replaceImage(
    @Param('id', rewardId()) id: number,
    @UploadedFile() file: UploadedImage | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiImageUpload> {
    return this.rewards.replaceImage(id, file, user);
  }

  @Delete(':id/image')
  @HttpCode(204)
  removeImage(
    @Param('id', rewardId()) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.rewards.removeImage(id, user);
  }
}
