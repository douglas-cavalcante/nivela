import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  ApiList,
  ApiPracticeNext,
  ApiPracticeSubject,
} from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PracticeNextQuery } from 'src/modules/answers/dto/practice-next.query';
import { PracticeService } from 'src/modules/answers/practice.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

@ApiTags('practice')
@ApiBearerAuth()
@Roles(Role.Student)
@Controller('practice')
export class PracticeController {
  constructor(private readonly practice: PracticeService) {}

  @Get('subjects')
  async subjects(
    @CurrentUser() user: AuthUser,
  ): Promise<ApiList<ApiPracticeSubject>> {
    return { data: await this.practice.subjects(user) };
  }

  @Get('next')
  next(
    @Query() query: PracticeNextQuery,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiPracticeNext> {
    return this.practice.next(user, query);
  }
}
