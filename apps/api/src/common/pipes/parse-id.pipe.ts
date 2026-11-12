import { NotFoundException, PipeTransform } from '@nestjs/common';

// Maior valor de uma coluna INTEGER do PostgreSQL.
const MAX_ID = 2_147_483_647;

/**
 * Converte o `:id` da rota em número. Id que não seja um inteiro positivo
 * nunca existe, então responde 404 com a mensagem do recurso (em vez de 400
 * ou de estourar no banco).
 */
export class ParseIdPipe implements PipeTransform<string, number> {
  constructor(private readonly notFoundMessage: string) {}

  transform(value: string): number {
    const id = /^\d+$/.test(value) ? Number(value) : NaN;
    if (!Number.isSafeInteger(id) || id < 1 || id > MAX_ID) {
      throw new NotFoundException(this.notFoundMessage);
    }
    return id;
  }
}
