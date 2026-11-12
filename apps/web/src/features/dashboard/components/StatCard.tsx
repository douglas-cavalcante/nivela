import { Box, Typography } from '@mui/material';
import { penShadow } from '@nivela/design-tokens';
import type { ReactNode } from 'react';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

interface StatCardProps {
  label: string;
  value: string;
  /** Rodapé opcional (por exemplo, um link). */
  footer?: ReactNode;
}

/** Indicador do Início: número grande sobre um cartão de caderno. */
export function StatCard({ label, value, footer }: StatCardProps) {
  const colors = useNivelaColors();
  return (
    <Box
      role="group"
      aria-label={label}
      sx={{
        p: 2.5,
        border: `${penShadow.width}px solid ${colors.border}`,
        borderRadius: 2,
        boxShadow: `${penShadow.offset}px ${penShadow.offset}px 0 ${colors.shadow}`,
        backgroundColor: 'background.paper',
      }}
    >
      <Typography variant="overline" color="text.secondary" component="p" sx={{ lineHeight: 1.4 }}>
        {label}
      </Typography>
      <Typography variant="h2" component="p" sx={{ fontWeight: 800 }}>
        {value}
      </Typography>
      {footer ? <Box sx={{ mt: 0.5 }}>{footer}</Box> : null}
    </Box>
  );
}
