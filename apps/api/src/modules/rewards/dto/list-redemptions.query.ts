import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EmptyAsUndefined } from 'src/common/decorators/empty-as-undefined.decorator';
import { Trim } from 'src/common/decorators/trim.decorator';
import { ListMyRedemptionsQuery } from 'src/modules/rewards/dto/list-my-redemptions.query';

const MAX_ID = 2_147_483_647;
const CLASSROOM_MESSAGE = 'A turma deve ser um número inteiro.';

/** Query de `GET /redemptions` (fila da equipe; sem `status`, só os pendentes). */
export class ListRedemptionsQuery extends ListMyRedemptionsQuery {
  /** Parte do nome do aluno. */
  @EmptyAsUndefined()
  @IsOptional()
  @Trim()
  @IsString({ message: 'A busca deve ser um texto.' })
  @MaxLength(120, { message: 'A busca deve ter no máximo 120 caracteres.' })
  search?: string;

  @EmptyAsUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: CLASSROOM_MESSAGE })
  @Min(1, { message: CLASSROOM_MESSAGE })
  @Max(MAX_ID, { message: CLASSROOM_MESSAGE })
  classroom_id?: number;
}
