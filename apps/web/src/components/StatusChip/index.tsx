import { Chip } from '@mui/material';

/** Situação de um cadastro: o texto leva a informação, a cor só reforça. */
export function StatusChip({ active }: { active: boolean }) {
  const color = active ? 'success.main' : 'text.secondary';
  return (
    <Chip
      size="small"
      variant="outlined"
      label={active ? 'Ativo' : 'Inativo'}
      sx={{ color, borderColor: color, '& .MuiChip-label': { px: 1.25 } }}
    />
  );
}
