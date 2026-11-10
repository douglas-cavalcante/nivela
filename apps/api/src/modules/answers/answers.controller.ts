import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ApiAnswerResult } from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AnswersService } from 'src/modules/answers/answers.service';
import { AnswerDto } from 'src/modules/answers/dto/answer.dto';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

@ApiTags('answers')
@ApiBearerAuth()
@Roles(Role.Student)
@Controller('answers')
export class AnswersController {
  constructor(private readonly answers: AnswersService) {}

  @Post()
  @HttpCode(200)
  answer(
    @Body() dto: AnswerDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiAnswerResult> {
    return this.answers.answer(user, dto);
  }
}
