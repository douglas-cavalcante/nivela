import { IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from 'src/common/decorators/trim.decorator';

const MESSAGE = 'O motivo deve ter de 3 a 300 caracteres.';

/** Corpo de `POST /redemptions/:id/reject`. */
export class RejectRedemptionDto {
  @Trim()
  @IsString({ message: MESSAGE })
  @MinLength(3, { message: MESSAGE })
  @MaxLength(300, { message: MESSAGE })
  reason: string;
}
