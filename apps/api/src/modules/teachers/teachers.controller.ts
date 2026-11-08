import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ApiTeacher, Paginated } from '@nivela/api-contract';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';
import { CreateTeacherDto } from 'src/modules/teachers/dto/create-teacher.dto';
import { ListTeachersQuery } from 'src/modules/teachers/dto/list-teachers.query';
import { TeacherPasswordDto } from 'src/modules/teachers/dto/teacher-password.dto';
import { TeacherStatusDto } from 'src/modules/teachers/dto/teacher-status.dto';
import { UpdateTeacherDto } from 'src/modules/teachers/dto/update-teacher.dto';
import { TeachersService } from 'src/modules/teachers/teachers.service';
import { Role } from 'src/shared/enums/role.enum';

const teacherId = () => new ParseIdPipe('Professor não encontrado.');

@ApiTags('teachers')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Get()
  list(@Query() query: ListTeachersQuery): Promise<Paginated<ApiTeacher>> {
    return this.teachers.list(query);
  }

  @Post()
  create(@Body() dto: CreateTeacherDto): Promise<ApiTeacher> {
    return this.teachers.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', teacherId()) id: number,
    @Body() dto: UpdateTeacherDto,
  ): Promise<ApiTeacher> {
    return this.teachers.update(id, dto);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id', teacherId()) id: number,
    @Body() dto: TeacherStatusDto,
  ): Promise<ApiTeacher> {
    return this.teachers.setStatus(id, dto.active);
  }

  @Put(':id/password')
  @HttpCode(204)
  resetPassword(
    @Param('id', teacherId()) id: number,
    @Body() dto: TeacherPasswordDto,
  ): Promise<void> {
    return this.teachers.resetPassword(id, dto.password);
  }
}
