import type { ApiReward, ApiStoreReward } from '@nivela/api-contract';

export interface RewardRow {
  id: number;
  createdBy: number;
  name: string;
  description: string | null;
  imagePath: string | null;
  price: number;
  stock: number;
  active: boolean;
  updatedAt: Date;
  creator: { id: number; name: string };
  /** `redemptions` conta só os resgates pendentes. */
  _count: { redemptions: number };
}

export function presentReward(
  row: RewardRow,
  imageUrl: string | null,
  canEdit: boolean,
): ApiReward {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    image_url: imageUrl,
    price: row.price,
    stock: row.stock,
    active: row.active,
    created_by: { id: row.creator.id, name: row.creator.name },
    can_edit: canEdit,
    pending_redemptions: row._count.redemptions,
    updated_at: row.updatedAt.toISOString(),
  } satisfies ApiReward;
}

export function presentStoreReward(
  row: Pick<RewardRow, 'id' | 'name' | 'description' | 'price' | 'stock'>,
  imageUrl: string | null,
  balance: number,
): ApiStoreReward {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    image_url: imageUrl,
    price: row.price,
    stock: row.stock,
    affordable: balance >= row.price,
  } satisfies ApiStoreReward;
}
