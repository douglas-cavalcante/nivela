import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Mascot } from 'src/components/Mascot';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Estado vazio com o mascote Rabisco: listas sem itens, telas "em breve" etc. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 1,
        py: 6,
        px: 3,
        border: (theme) => `2px dashed ${theme.palette.text.secondary}`,
        borderRadius: 4,
        backgroundColor: 'background.paper',
      }}
    >
      <Mascot size={112} />
      <Typography variant="h3" component="h2">
        {title}
      </Typography>
      {description ? (
        <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ mt: 2 }}>{action}</Box> : null}
    </Box>
  );
}
