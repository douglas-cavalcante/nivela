import { Box, Typography } from '@mui/material';
import { penShadow } from '@nivela/design-tokens';
import type { ReactNode } from 'react';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

interface PanelProps {
  title: string;
  /** Âncora para links dentro da página. */
  id?: string;
  children: ReactNode;
}

/** Seção do Início: título e conteúdo sobre um cartão de caderno. */
export function Panel({ title, id, children }: PanelProps) {
  const colors = useNivelaColors();
  return (
    <Box
      component="section"
      id={id}
      aria-label={title}
      sx={{
        p: 3,
        border: `${penShadow.width}px solid ${colors.border}`,
        borderRadius: 2,
        boxShadow: `${penShadow.offset}px ${penShadow.offset}px 0 ${colors.shadow}`,
        backgroundColor: 'background.paper',
        scrollMarginTop: 16,
      }}
    >
      <Typography variant="h4" component="h2" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}
