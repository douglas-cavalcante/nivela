import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  ApiStudent,
  ApiStudentSummary,
  Paginated,
} from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';
import { ListStudentsQuery } from 'src/modules/students/dto/list-students.query';
import { StudentsService } from 'src/modules/students/students.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

/** Alunos da equipe: o professor vê só os matriculados nas turmas dele. */
@ApiTags('students')
@ApiBearerAuth()
@Roles(Role.Admin, Role.Teacher)
@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list(
    @Query() query: ListStudentsQuery,
    @CurrentUser() user: AuthUser,
  ): Promise<Paginated<ApiStudentSummary>> {
    return this.students.list(query, user);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseIdPipe('Aluno não encontrado.')) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiStudent> {
    return this.students.findOne(id, user);
  }
}
