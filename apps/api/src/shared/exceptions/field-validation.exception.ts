import { UnprocessableEntityException } from '@nestjs/common';

/** Erro de validação de regra de negócio no formato 422 `{ message, errors }`. */
export class FieldValidationException extends UnprocessableEntityException {
  constructor(errors: Record<string, string[]>) {
    super({ message: 'Os dados enviados são inválidos.', errors });
  }
}
