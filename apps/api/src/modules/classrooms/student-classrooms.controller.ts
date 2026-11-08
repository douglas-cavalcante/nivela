import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ApiList, ApiMyClassroom } from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ClassroomsService } from 'src/modules/classrooms/classrooms.service';
import { JoinClassroomDto } from 'src/modules/classrooms/dto/join-classroom.dto';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

/** Turmas do próprio aluno (aplicativo). */
@ApiTags('me')
@ApiBearerAuth()
@Roles(Role.Student)
@Controller('me/classrooms')
export class StudentClassroomsController {
  constructor(private readonly classrooms: ClassroomsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<ApiList<ApiMyClassroom>> {
    return { data: await this.classrooms.listMine(user) };
  }

  @Post()
  join(
    @Body() dto: JoinClassroomDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiMyClassroom> {
    return this.classrooms.joinMine(dto.join_code, user);
  }
}
