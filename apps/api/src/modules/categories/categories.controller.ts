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
import type { ApiCategory, ApiList } from '@nivela/api-contract';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';
import { CategoriesService } from 'src/modules/categories/categories.service';
import {
  CreateCategoryDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from 'src/modules/categories/dto/category.dto';
import { Role } from 'src/shared/enums/role.enum';

const categoryId = () => new ParseIdPipe('Categoria não encontrada.');

/**
 * `@Roles` fica em cada rota (e não na classe) de propósito: as leituras de
 * categorias são as candidatas a abrir para outros perfis (ex.: o aluno ver as
 * categorias no app), e cada rota declarando o próprio perfil deixa essa troca
 * explícita sem afrouxar as escritas, que continuam só da equipe. O teste
 * `route-authorization` garante que nenhuma rota fique sem declaração.
 */
@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Roles(Role.Admin, Role.Teacher)
  @Get()
  async list(
    @Query() query: ListCategoriesQueryDto,
  ): Promise<ApiList<ApiCategory>> {
    return { data: await this.categories.list(query.subject_id) };
  }

  @Roles(Role.Admin, Role.Teacher)
  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<ApiCategory> {
    return this.categories.create(dto);
  }

  @Roles(Role.Admin, Role.Teacher)
  @Put(':id')
  update(
    @Param('id', categoryId()) id: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<ApiCategory> {
    return this.categories.update(id, dto);
  }

  @Roles(Role.Admin, Role.Teacher)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', categoryId()) id: number): Promise<void> {
    return this.categories.remove(id);
  }
}
