import { Chip } from '@mui/material';
import type { PlanStatus } from '@nivela/api-contract';

/** Situação do plano: o texto leva a informação, a cor só reforça. */
export function PlanStatusChip({ status }: { status: PlanStatus }) {
  const published = status === 'published';
  const color = published ? 'success.main' : 'text.secondary';
  return (
    <Chip
      size="small"
      variant="outlined"
      label={published ? 'Publicado' : 'Rascunho'}
      sx={{ color, borderColor: color, borderStyle: published ? 'solid' : 'dashed', '& .MuiChip-label': { px: 1.25 } }}
    />
  );
}
