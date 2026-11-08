import { HttpException, HttpStatus } from '@nestjs/common';

/** Regra de negócio violada: responde 409 com `{ message }`. */
export class BusinessRuleException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.CONFLICT);
  }
}
