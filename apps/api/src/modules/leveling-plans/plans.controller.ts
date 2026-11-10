import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  ApiList,
  ApiPlan,
  ApiPlanAssignment,
  ApiPlanProgressRow,
  ApiPlanSummary,
  Paginated,
} from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';
import { AssignmentsService } from 'src/modules/leveling-plans/assignments.service';
import { ChaptersService } from 'src/modules/leveling-plans/chapters.service';
import { AssignmentDto } from 'src/modules/leveling-plans/dto/assignment.dto';
import { ChapterOrderDto } from 'src/modules/leveling-plans/dto/chapter-order.dto';
import { ChapterQuestionsDto } from 'src/modules/leveling-plans/dto/chapter-questions.dto';
import { ChapterDto } from 'src/modules/leveling-plans/dto/chapter.dto';
import { ListPlansQuery } from 'src/modules/leveling-plans/dto/list-plans.query';
import { PlanDto } from 'src/modules/leveling-plans/dto/plan.dto';
import { PlanProgressService } from 'src/modules/leveling-plans/plan-progress.service';
import { PlansService } from 'src/modules/leveling-plans/plans.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

const planId = () => new ParseIdPipe('Plano não encontrado.');
const chapterId = () => new ParseIdPipe('Capítulo não encontrado.');

/** Planos de nivelamento da equipe: o professor vê só os próprios, o administrador vê todos. */
@ApiTags('plans')
@ApiBearerAuth()
@Roles(Role.Admin, Role.Teacher)
@Controller('plans')
export class PlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly chapters: ChaptersService,
    private readonly assignments: AssignmentsService,
    private readonly progress: PlanProgressService,
  ) {}

  @Get()
  list(
    @Query() query: ListPlansQuery,
    @CurrentUser() user: AuthUser,
  ): Promise<Paginated<ApiPlanSummary>> {
    return this.plans.list(query, user);
  }

  @Post()
  create(
    @Body() dto: PlanDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiPlan> {
    return this.plans.create(dto, user);
  }

  @Get(':id')
  findOne(
    @Param('id', planId()) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiPlan> {
    return this.plans.findOne(id, user);
  }

  @Put(':id')
  update(
    @Param('id', planId()) id: number,
    @Body() dto: PlanDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiPlan> {
    return this.plans.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('id', planId()) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.plans.remove(id, user);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(
    @Param('id', planId()) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiPlan> {
    return this.plans.publish(id, user);
  }

  @Post(':id/chapters')
  addChapter(
    @Param('id', planId()) id: number,
    @Body() dto: ChapterDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiPlan> {
    return this.chapters.create(id, dto, user);
  }

  // Declarada antes de `chapters/:chapterId` para `order` não virar id.
  @Put(':id/chapters/order')
  reorderChapters(
    @Param('id', planId()) id: number,
    @Body() dto: ChapterOrderDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiPlan> {
    return this.chapters.reorder(id, dto.chapter_ids, user);
  }

  @Put(':id/chapters/:chapterId')
  renameChapter(
    @Param('id', planId()) id: number,
    @Param('chapterId', chapterId()) chapter: number,
    @Body() dto: ChapterDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiPlan> {
    return this.chapters.rename(id, chapter, dto, user);
  }

  @Delete(':id/chapters/:chapterId')
  removeChapter(
    @Param('id', planId()) id: number,
    @Param('chapterId', chapterId()) chapter: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiPlan> {
    return this.chapters.remove(id, chapter, user);
  }

  @Put(':id/chapters/:chapterId/questions')
  setQuestions(
    @Param('id', planId()) id: number,
    @Param('chapterId', chapterId()) chapter: number,
    @Body() dto: ChapterQuestionsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiPlan> {
    return this.chapters.setQuestions(id, chapter, dto.question_ids, user);
  }

  @Get(':id/progress')
  listProgress(
    @Param('id', planId()) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiList<ApiPlanProgressRow>> {
    return this.progress.progress(id, user);
  }

  @Get(':id/assignments')
  listAssignments(
    @Param('id', planId()) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiList<ApiPlanAssignment>> {
    return this.assignments.list(id, user);
  }

  @Post(':id/assignments')
  assign(
    @Param('id', planId()) id: number,
    @Body() dto: AssignmentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiPlanAssignment> {
    return this.assignments.create(id, dto, user);
  }

  @Delete(':id/assignments/:assignmentId')
  @HttpCode(204)
  unassign(
    @Param('id', planId()) id: number,
    @Param('assignmentId', new ParseIdPipe('Atribuição não encontrada.'))
    assignment: number,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.assignments.remove(id, assignment, user);
  }
}
