import { IsIn, IsOptional } from 'class-validator';
import { EmptyAsUndefined } from 'src/common/decorators/empty-as-undefined.decorator';
import { PaginationQueryDto } from 'src/shared/pagination/pagination-query.dto';

export const REDEMPTION_STATUSES = [
  'pending',
  'delivered',
  'rejected',
] as const;

/** Query de `GET /store/redemptions`. */
export class ListMyRedemptionsQuery extends PaginationQueryDto {
  @EmptyAsUndefined()
  @IsOptional()
  @IsIn(REDEMPTION_STATUSES, {
    message: 'A situação deve ser pending, delivered ou rejected.',
  })
  status?: (typeof REDEMPTION_STATUSES)[number];
}
