import type { ApiMyRedemption, ApiRedemption } from '@nivela/api-contract';
import type { RedemptionStatus } from 'src/generated/prisma/client';

export interface RedemptionRow {
  id: number;
  pricePaid: number;
  status: RedemptionStatus;
  rejectionReason: string | null;
  createdAt: Date;
  handledAt: Date | null;
  reward: { id: number; name: string; imagePath: string | null };
}

export interface StaffRedemptionRow extends RedemptionRow {
  student: {
    id: number;
    name: string;
    /** Só as matrículas que quem consulta pode ver. */
    enrollments: Array<{ classroom: { id: number; name: string } }>;
  };
  handler: { id: number; name: string } | null;
}

type ImageUrl = (imagePath: string | null) => string | null;

export function presentMyRedemption(
  row: RedemptionRow,
  imageUrl: ImageUrl,
): ApiMyRedemption {
  return {
    id: row.id,
    reward: {
      id: row.reward.id,
      name: row.reward.name,
      image_url: imageUrl(row.reward.imagePath),
    },
    price_paid: row.pricePaid,
    status: row.status,
    rejection_reason: row.rejectionReason,
    created_at: row.createdAt.toISOString(),
    handled_at: row.handledAt?.toISOString() ?? null,
  } satisfies ApiMyRedemption;
}

export function presentRedemption(
  row: StaffRedemptionRow,
  imageUrl: ImageUrl,
): ApiRedemption {
  return {
    ...presentMyRedemption(row, imageUrl),
    student: {
      id: row.student.id,
      name: row.student.name,
      classrooms: row.student.enrollments.map(({ classroom }) => ({
        id: classroom.id,
        name: classroom.name,
      })),
    },
    handled_by: row.handler
      ? { id: row.handler.id, name: row.handler.name }
      : null,
  } satisfies ApiRedemption;
}
