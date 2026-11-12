import { Chip } from '@mui/material';
import type { RedemptionStatus } from '@nivela/api-contract';

const STATUS: Record<RedemptionStatus, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'warning.main' },
  delivered: { label: 'Entregue', color: 'success.main' },
  rejected: { label: 'Recusado', color: 'error.main' },
};

/** Situação de um resgate: o texto leva a informação, a cor só reforça. */
export function RedemptionStatusChip({ status }: { status: RedemptionStatus }) {
  const { label, color } = STATUS[status];
  return (
    <Chip
      size="small"
      variant="outlined"
      label={label}
      sx={{ color, borderColor: color, '& .MuiChip-label': { px: 1.25 } }}
    />
  );
}
