import {
  UnprocessableEntityException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';

export const VALIDATION_MESSAGE = 'Os dados enviados são inválidos.';

/** Achata os erros do class-validator em `{ "campo.aninhado": ["mensagem"] }`. */
export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) {
      result[path] = Object.values(error.constraints);
    }
    if (error.children?.length) {
      Object.assign(result, flattenValidationErrors(error.children, path));
    }
  }
  return result;
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors) =>
      new UnprocessableEntityException({
        message: VALIDATION_MESSAGE,
        errors: flattenValidationErrors(errors),
      }),
  });
}
