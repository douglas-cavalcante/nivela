import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Trim } from 'src/common/decorators/trim.decorator';

export const MAX_PRICE = 100_000;
export const MAX_STOCK = 100_000;

const PRICE_MESSAGE = 'O preço deve ser um número inteiro de 1 a 100000.';
const STOCK_MESSAGE = 'O estoque deve ser um número inteiro de 0 a 100000.';

/** Corpo de `POST /rewards` e `PUT /rewards/:id`. */
export class RewardDto {
  @Trim()
  @IsString({ message: 'Informe o nome do prêmio.' })
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres.' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres.' })
  name: string;

  /** Texto vazio vira `null` (a pessoa limpou o campo). */
  @IsOptional()
  @Trim({ emptyAsNull: true })
  @IsString({ message: 'A descrição deve ser um texto.' })
  @MaxLength(500, {
    message: 'A descrição deve ter no máximo 500 caracteres.',
  })
  description?: string | null;

  @IsInt({ message: PRICE_MESSAGE })
  @Min(1, { message: PRICE_MESSAGE })
  @Max(MAX_PRICE, { message: PRICE_MESSAGE })
  price: number;

  @IsInt({ message: STOCK_MESSAGE })
  @Min(0, { message: STOCK_MESSAGE })
  @Max(MAX_STOCK, { message: STOCK_MESSAGE })
  stock: number;
}
