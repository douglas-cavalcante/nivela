import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  ApiActivityDay,
  ApiCategoryPerformance,
  ApiDashboardSummary,
  ApiList,
  ApiQuestionSummary,
  ApiStudentNeedingHelp,
} from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';
import { DashboardService } from 'src/modules/dashboard/dashboard.service';
import { ActivityQuery } from 'src/modules/dashboard/dto/activity.query';
import { PerformanceService } from 'src/modules/dashboard/performance.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

/** Indicadores do Início da equipe, sempre dentro do escopo do usuário. */
@ApiTags('dashboard')
@ApiBearerAuth()
@Roles(Role.Admin, Role.Teacher)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser): Promise<ApiDashboardSummary> {
    return this.dashboard.summary(user);
  }

  @Get('activity')
  activity(
    @Query() query: ActivityQuery,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiList<ApiActivityDay>> {
    return this.dashboard.activity(user, query.days ?? 14);
  }

  @Get('needing-help')
  needingHelp(
    @CurrentUser() user: AuthUser,
  ): Promise<ApiList<ApiStudentNeedingHelp>> {
    return this.dashboard.needingHelp(user);
  }

  @Get('recent-questions')
  recentQuestions(): Promise<ApiList<ApiQuestionSummary>> {
    return this.dashboard.recentQuestions();
  }
}

/** Desempenho por categoria de uma turma ou de um aluno (todo o histórico). */
@ApiTags('performance')
@ApiBearerAuth()
@Roles(Role.Admin, Role.Teacher)
@Controller()
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}

  @Get('classrooms/:id/performance')
  forClassroom(
    @Param('id', new ParseIdPipe('Turma não encontrada.')) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiList<ApiCategoryPerformance>> {
    return this.performance.forClassroom(id, user);
  }

  @Get('students/:id/performance')
  forStudent(
    @Param('id', new ParseIdPipe('Aluno não encontrado.')) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiList<ApiCategoryPerformance>> {
    return this.performance.forStudent(id, user);
  }
}
