import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type {
  ApiQuestion,
  ApiQuestionSummary,
  Paginated,
} from '@nivela/api-contract';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';
import { ListQuestionsQuery } from 'src/modules/questions/dto/list-questions.query';
import { QuestionStatusDto } from 'src/modules/questions/dto/question-status.dto';
import { QuestionDto } from 'src/modules/questions/dto/question.dto';
import {
  HARD_UPLOAD_LIMIT_BYTES,
  type UploadedImage,
} from 'src/modules/questions/question-image.service';
import { QuestionsService } from 'src/modules/questions/questions.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

const questionId = () => new ParseIdPipe('Questão não encontrada.');

@ApiTags('questions')
@ApiBearerAuth()
@Roles(Role.Admin, Role.Teacher)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  list(
    @Query() query: ListQuestionsQuery,
  ): Promise<Paginated<ApiQuestionSummary>> {
    return this.questions.list(query);
  }

  @Get(':id')
  findOne(
    @Param('id', questionId()) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiQuestion> {
    return this.questions.findOne(id, user);
  }

  @Post()
  create(
    @Body() dto: QuestionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiQuestion> {
    return this.questions.create(dto, user);
  }

  @Put(':id')
  update(
    @Param('id', questionId()) id: number,
    @Body() dto: QuestionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiQuestion> {
    return this.questions.update(id, dto, user);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id', questionId()) id: number,
    @Body() dto: QuestionStatusDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiQuestion> {
    return this.questions.setStatus(id, dto.active, user);
  }

  /**
   * Sem `storage`, o multer guarda o arquivo em memória: nada vai ao disco antes
   * da validação por assinatura e tamanho (o limite duro evita estourar a memória).
   */
  @Post(':id/image')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: HARD_UPLOAD_LIMIT_BYTES,
        files: 1,
        fields: 5,
        parts: 6,
        fieldSize: 1024,
      },
    }),
  )
  replaceImage(
    @Param('id', questionId()) id: number,
    @UploadedFile() file: UploadedImage | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<{ image_url: string }> {
    return this.questions.replaceImage(id, file, user);
  }

  @Delete(':id/image')
  @HttpCode(204)
  removeImage(
    @Param('id', questionId()) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.questions.removeImage(id, user);
  }
}
