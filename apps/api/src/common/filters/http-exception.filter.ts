import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

export interface ErrorBody {
  message: string;
  errors?: Record<string, string[]>;
}

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'Requisição inválida.',
  401: 'Não autenticado.',
  403: 'Você não tem permissão para acessar este recurso.',
  404: 'Recurso não encontrado.',
  405: 'Método não permitido.',
  409: 'Conflito ao processar a requisição.',
  413: 'Conteúdo muito grande.',
  422: 'Os dados enviados são inválidos.',
  429: 'Muitas requisições. Tente novamente em instantes.',
};
const INTERNAL_ERROR_MESSAGE = 'Erro interno do servidor.';

// Mensagens em inglês geradas pelo próprio Nest (ex.: "Cannot GET /x").
const FRAMEWORK_MESSAGES = [
  'Bad Request',
  'Unauthorized',
  'Forbidden',
  'Not Found',
  'Method Not Allowed',
  'Conflict',
  'Payload Too Large',
  'Too Many Requests',
];

/**
 * Padroniza todas as respostas de erro como `{ message, errors? }`, sem
 * vazar stack nem mensagens internas.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
      const body: ErrorBody = { message: INTERNAL_ERROR_MESSAGE };
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
      return;
    }

    const status = exception.getStatus();
    response.status(status).json(this.buildBody(exception, status));
  }

  private buildBody(exception: HttpException, status: number): ErrorBody {
    const fallback = DEFAULT_MESSAGES[status] ?? INTERNAL_ERROR_MESSAGE;
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { message: this.isFrameworkMessage(payload) ? fallback : payload };
    }

    const { message, errors } = payload as {
      message?: string | string[];
      errors?: Record<string, string[]>;
    };
    const text = Array.isArray(message) ? message[0] : message;
    const body: ErrorBody = {
      message: !text || this.isFrameworkMessage(text) ? fallback : text,
    };
    if (errors) {
      body.errors = errors;
    }
    return body;
  }

  private isFrameworkMessage(text: string): boolean {
    return text.startsWith('Cannot ') || FRAMEWORK_MESSAGES.includes(text);
  }
}
