import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  ApiList,
  ApiMyPlan,
  ApiMyPlanSummary,
} from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';
import { PLAN_NOT_FOUND } from 'src/modules/leveling-plans/plans.service';
import { StudentPlansService } from 'src/modules/leveling-plans/student-plans.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

/** Planos de nivelamento do aluno logado. */
@ApiTags('me')
@ApiBearerAuth()
@Roles(Role.Student)
@Controller('me/plans')
export class MePlansController {
  constructor(private readonly plans: StudentPlansService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ApiList<ApiMyPlanSummary>> {
    return this.plans.list(user);
  }

  @Get(':id')
  detail(
    @Param('id', new ParseIdPipe(PLAN_NOT_FOUND)) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiMyPlan> {
    return this.plans.detail(user, id);
  }
}
