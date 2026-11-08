import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  ApiClassroom,
  ApiClassroomSummary,
  Paginated,
} from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';
import { ClassroomsService } from 'src/modules/classrooms/classrooms.service';
import { CreateClassroomDto } from 'src/modules/classrooms/dto/create-classroom.dto';
import { ListClassroomsQuery } from 'src/modules/classrooms/dto/list-classrooms.query';
import { UpdateClassroomDto } from 'src/modules/classrooms/dto/update-classroom.dto';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

const classroomId = () => new ParseIdPipe('Turma não encontrada.');

/** Turmas da equipe: o professor vê só as próprias, o administrador vê todas. */
@ApiTags('classrooms')
@ApiBearerAuth()
@Roles(Role.Admin, Role.Teacher)
@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classrooms: ClassroomsService) {}

  @Get()
  list(
    @Query() query: ListClassroomsQuery,
    @CurrentUser() user: AuthUser,
  ): Promise<Paginated<ApiClassroomSummary>> {
    return this.classrooms.list(query, user);
  }

  @Post()
  create(
    @Body() dto: CreateClassroomDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiClassroom> {
    return this.classrooms.create(dto, user);
  }

  @Get(':id')
  findOne(
    @Param('id', classroomId()) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiClassroom> {
    return this.classrooms.findOne(id, user);
  }

  @Put(':id')
  update(
    @Param('id', classroomId()) id: number,
    @Body() dto: UpdateClassroomDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiClassroom> {
    return this.classrooms.update(id, dto, user);
  }

  @Post(':id/join-code')
  @HttpCode(200)
  regenerateJoinCode(
    @Param('id', classroomId()) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<{ join_code: string }> {
    return this.classrooms.regenerateJoinCode(id, user);
  }
}
