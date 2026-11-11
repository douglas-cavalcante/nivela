import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ApiChapterNext } from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';
import { PracticeService } from 'src/modules/answers/practice.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

/** Estudo dentro de um capítulo de plano do aluno. */
@ApiTags('me')
@ApiBearerAuth()
@Roles(Role.Student)
@Controller('me/plans')
export class MeChapterController {
  constructor(private readonly practice: PracticeService) {}

  @Get(':id/chapters/:chapterId/next')
  next(
    @Param('id', new ParseIdPipe('Plano não encontrado.')) id: number,
    @Param('chapterId', new ParseIdPipe('Capítulo não encontrado.'))
    chapterId: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiChapterNext> {
    return this.practice.chapterNext(user, id, chapterId);
  }
}
