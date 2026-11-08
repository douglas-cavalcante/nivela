import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ApiList, ApiSubject } from '@nivela/api-contract';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';
import { SubjectDto } from 'src/modules/subjects/dto/subject.dto';
import { SubjectsService } from 'src/modules/subjects/subjects.service';
import { Role } from 'src/shared/enums/role.enum';

const subjectId = () => new ParseIdPipe('Disciplina não encontrada.');

@ApiTags('subjects')
@ApiBearerAuth()
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Roles(Role.Admin, Role.Teacher)
  @Get()
  async list(): Promise<ApiList<ApiSubject>> {
    return { data: await this.subjects.list() };
  }

  @Roles(Role.Admin, Role.Teacher)
  @Post()
  create(@Body() dto: SubjectDto): Promise<ApiSubject> {
    return this.subjects.create(dto);
  }

  @Roles(Role.Admin, Role.Teacher)
  @Put(':id')
  update(
    @Param('id', subjectId()) id: number,
    @Body() dto: SubjectDto,
  ): Promise<ApiSubject> {
    return this.subjects.update(id, dto);
  }

  @Roles(Role.Admin, Role.Teacher)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', subjectId()) id: number): Promise<void> {
    return this.subjects.remove(id);
  }
}
