import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  INestApplication,
  Logger,
} from '@nestjs/common';
import { AbstractHttpAdapter } from '@nestjs/core';
import type { ErrorBody } from '@nivela/api-contract';
import type { Response } from 'express';
import { STATUS_CODES } from 'node:http';

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'Requisição inválida.',
  401: 'Não autenticado.',
  403: 'Você não tem permissão para acessar este recurso.',
  404: 'Recurso não encontrado.',
  405: 'Método não permitido.',
  406: 'Formato de resposta não suportado.',
  409: 'Conflito ao processar a requisição.',
  413: 'Requisição muito grande.',
  415: 'Tipo de conteúdo não suportado.',
  422: 'Os dados enviados são inválidos.',
  429: 'Muitas requisições. Tente novamente em instantes.',
};
const INTERNAL_ERROR_MESSAGE = 'Erro interno do servidor.';
const FILE_TOO_LARGE_MESSAGE = 'Arquivo muito grande.';

// Mensagens dos pipes embutidos do Nest que têm tradução própria (as demais
// "Validation failed (...)" caem no texto padrão do status).
// ParseFilePipe: "File is required" e os validadores de tamanho e tipo;
// ParseUUIDPipe: "Validation failed (uuid v4 is expected)";
// ParseArrayPipe: "Validation failed (parsable array expected)" e "[1] <erro do item>".
const PIPE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/^File is required/, 'Envie um arquivo.'],
  [/^Validation failed \(current file size/, FILE_TOO_LARGE_MESSAGE],
  [
    /^Validation failed \((current file type|file type could not|file buffer is not available|expected type)/,
    'Tipo de arquivo não suportado.',
  ],
  [/^Validation failed \(uuid/, 'Identificador inválido.'],
  [/^Validation failed \(parsable array expected/, 'Lista inválida.'],
  [/^\[\d+\] /, 'Lista inválida.'],
];

// Textos padrão dos status HTTP ("Bad Request", "Gone"…), que o Nest usa
// quando a exceção é criada sem mensagem, mais o do 500 do próprio Nest.
const STATUS_TEXTS = new Set([
  ...Object.values(STATUS_CODES),
  'Internal server error',
]);

// Mensagens em inglês geradas pelo Nest e pelo multer/busboy (upload):
// "Cannot GET /x", "Validation failed (numeric string is expected)",
// "Unexpected file field - foto", "Multipart: Malformed part header"…
// Ver @nestjs/platform-express/multer/multer/multer.constants.js.
const FRAMEWORK_PREFIXES = [
  'Cannot ',
  'Validation failed',
  'Multipart: ',
  'Too many parts',
  'File too large',
  'Too many files',
  'Field name too long',
  'Field value too long',
  'Too many fields',
  'Unexpected file field',
  'Unexpected field',
  'Field name missing',
  'Field name nesting too deep',
  'Field name array index too large',
  'Invalid field name',
  'Unsupported content type',
];

/**
 * Padroniza todas as respostas de erro como `{ message, errors? }`, sem
 * vazar stack nem mensagens internas: nenhuma mensagem em inglês do
 * framework chega ao cliente.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      // Erros do body-parser que não viraram HttpException trazem o status.
      const clientStatus = this.clientErrorStatus(exception);
      if (clientStatus) {
        this.send(response, clientStatus, {
          message: this.fallback(clientStatus),
        });
        return;
      }
      this.logError(exception);
      this.send(response, HttpStatus.INTERNAL_SERVER_ERROR, {
        message: INTERNAL_ERROR_MESSAGE,
      });
      return;
    }

    const status = exception.getStatus();
    if (status >= 500) {
      this.logError(exception);
    }
    const body = this.isParserError(exception)
      ? { message: this.fallback(status) }
      : this.buildBody(exception, status);
    this.send(response, status, body);
  }

  private send(response: Response, status: number, body: ErrorBody): void {
    response.status(status).json(body);
  }

  private logError(exception: unknown): void {
    this.logger.error(
      exception instanceof Error ? exception.message : String(exception),
      exception instanceof Error ? exception.stack : undefined,
    );
  }

  private fallback(status: number): string {
    return (
      DEFAULT_MESSAGES[status] ??
      (status < 500 ? DEFAULT_MESSAGES[400] : INTERNAL_ERROR_MESSAGE)
    );
  }

  /**
   * Erros do body-parser e do Express: http-errors com `type`
   * (ex.: entity.parse.failed, entity.too.large) ou o SyntaxError/URIError
   * original, repassado como `cause` por {@link keepParserErrorCause}.
   */
  private isParserError(exception: HttpException): boolean {
    const { cause } = exception;
    if (cause instanceof SyntaxError || cause instanceof URIError) {
      return true;
    }
    return (
      typeof cause === 'object' &&
      cause !== null &&
      typeof (cause as { type?: unknown }).type === 'string'
    );
  }

  private clientErrorStatus(exception: unknown): number | undefined {
    if (typeof exception !== 'object' || exception === null) {
      return undefined;
    }
    const { status, statusCode } = exception as {
      status?: unknown;
      statusCode?: unknown;
    };
    const value = typeof status === 'number' ? status : statusCode;
    return typeof value === 'number' && value >= 400 && value < 500
      ? value
      : undefined;
  }

  private buildBody(exception: HttpException, status: number): ErrorBody {
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { message: this.clientMessage(payload, status) };
    }

    const { message, errors } = payload as {
      message?: string | string[];
      errors?: Record<string, string[]>;
    };
    const text = Array.isArray(message) ? message[0] : message;
    const body: ErrorBody = { message: this.clientMessage(text, status) };
    if (errors) {
      body.errors = errors;
    }
    return body;
  }

  /** Mantém mensagens próprias (pt-BR) e troca as do framework pelo padrão. */
  private clientMessage(text: string | undefined, status: number): string {
    if (!text || STATUS_TEXTS.has(text)) {
      return this.fallback(status);
    }
    if (status === 413 && text.startsWith('File too large')) {
      return FILE_TOO_LARGE_MESSAGE;
    }
    const translated = PIPE_TRANSLATIONS.find(([pattern]) =>
      pattern.test(text),
    );
    if (translated) {
      return translated[1];
    }
    if (FRAMEWORK_PREFIXES.some((prefix) => text.startsWith(prefix))) {
      return this.fallback(status);
    }
    return text;
  }
}

/**
 * O ExpressAdapter do Nest converte o SyntaxError do body-parser (JSON
 * malformado) e o URIError do Express (parâmetro com "%" inválido) em
 * BadRequestException com o texto em inglês e sem `cause`. Aqui o erro
 * original vira o `cause`, para o filtro reconhecê-lo sem depender do texto.
 */
export function keepParserErrorCause(app: INestApplication): void {
  const adapter = app.getHttpAdapter();
  if (!(adapter instanceof AbstractHttpAdapter)) {
    return;
  }
  const mapException = adapter.mapException.bind(adapter);
  adapter.mapException = (error: unknown): unknown =>
    error instanceof SyntaxError || error instanceof URIError
      ? new BadRequestException(DEFAULT_MESSAGES[400], { cause: error })
      : mapException(error);
}
