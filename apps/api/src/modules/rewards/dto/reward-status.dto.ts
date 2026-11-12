import { IsBoolean } from 'class-validator';

/** Corpo de `PATCH /rewards/:id/status`. */
export class RewardStatusDto {
  @IsBoolean({ message: 'Informe se o prêmio está ativo.' })
  active: boolean;
}
