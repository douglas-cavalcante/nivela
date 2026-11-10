import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ApiStudentStats } from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AnswersService } from 'src/modules/answers/answers.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

/** Moedas e sequência do próprio aluno. */
@ApiTags('me')
@ApiBearerAuth()
@Roles(Role.Student)
@Controller('me/stats')
export class MeStatsController {
  constructor(private readonly answers: AnswersService) {}

  @Get()
  stats(@CurrentUser() user: AuthUser): Promise<ApiStudentStats> {
    return this.answers.stats(user);
  }
}
