import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ApiList, ApiStudentPlanProgress } from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';
import { PlanProgressService } from 'src/modules/leveling-plans/plan-progress.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

/** Planos de um aluno visíveis para a equipe (ficha do aluno). */
@ApiTags('students')
@ApiBearerAuth()
@Roles(Role.Admin, Role.Teacher)
@Controller('students')
export class StudentPlansController {
  constructor(private readonly progress: PlanProgressService) {}

  @Get(':id/plans')
  list(
    @Param('id', new ParseIdPipe('Aluno não encontrado.')) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiList<ApiStudentPlanProgress>> {
    return this.progress.forStudent(id, user);
  }
}
