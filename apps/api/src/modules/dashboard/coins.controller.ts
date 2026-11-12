import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ApiCoinTransaction, Paginated } from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';
import { CoinsService } from 'src/modules/dashboard/coins.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';
import { PaginationQueryDto } from 'src/shared/pagination/pagination-query.dto';

/** Extrato de moedas de um aluno, para a equipe (dentro do escopo). */
@ApiTags('coins')
@ApiBearerAuth()
@Roles(Role.Admin, Role.Teacher)
@Controller('students/:id/coins')
export class StudentCoinsController {
  constructor(private readonly coins: CoinsService) {}

  @Get()
  statement(
    @Param('id', new ParseIdPipe('Aluno não encontrado.')) id: number,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Paginated<ApiCoinTransaction>> {
    return this.coins.forStudentAsStaff(id, query, user);
  }
}

/** Extrato de moedas do próprio aluno. */
@ApiTags('me')
@ApiBearerAuth()
@Roles(Role.Student)
@Controller('me/coins')
export class MeCoinsController {
  constructor(private readonly coins: CoinsService) {}

  @Get()
  statement(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Paginated<ApiCoinTransaction>> {
    return this.coins.forMe(user, query);
  }
}
