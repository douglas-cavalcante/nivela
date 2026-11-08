import { Body, Controller, Get, Post } from '@nestjs/common';
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
}
