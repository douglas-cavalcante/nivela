import {
  BadRequestException,
  Body,
  Controller,
  Get,
  GoneException,
  Param,
  ParseIntPipe,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsNotEmpty, IsString } from 'class-validator';
import { Public } from 'src/common/decorators/public.decorator';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';

class CreateThingDto {
  @IsString({ message: 'O nome deve ser um texto.' })
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  name: string;
}

/** Rotas que só existem nos testes, para exercitar o filtro de erros. */
@Public()
@Controller('__test')
export class TestErrorsController {
  @Post('validation')
  validation(@Body() dto: CreateThingDto) {
    return dto;
  }

  @Get('conflict')
  conflict() {
    throw new BusinessRuleException('Saldo insuficiente.');
  }

  @Get('boom')
  boom() {
    throw new Error('falha inesperada com detalhes internos');
  }

  @Get('int/:id')
  int(@Param('id', ParseIntPipe) id: number) {
    return { id };
  }

  @Get('json-field')
  jsonField() {
    throw new BadRequestException('Campo JSON inválido.');
  }

  @Get('gone')
  gone() {
    throw new GoneException();
  }

  @Get('unavailable')
  unavailable() {
    throw new ServiceUnavailableException();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 } }))
  upload(@UploadedFile() file: { originalname: string } | undefined) {
    return { name: file?.originalname };
  }
}
