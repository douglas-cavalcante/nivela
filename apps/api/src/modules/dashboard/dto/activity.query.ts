import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { EmptyAsUndefined } from 'src/common/decorators/empty-as-undefined.decorator';

const MESSAGE = 'A quantidade de dias deve ser um número inteiro de 7 a 60.';

/** Query de `GET /dashboard/activity`: `?days=14`. */
export class ActivityQuery {
  @EmptyAsUndefined()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: MESSAGE })
  @Min(7, { message: MESSAGE })
  @Max(60, { message: MESSAGE })
  days?: number = 14;
}
