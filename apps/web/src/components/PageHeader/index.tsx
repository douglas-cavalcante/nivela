import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

/** Cabeçalho de página: título manuscrito com marca-texto e ações à direita. */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const colors = useNivelaColors();
  // no tema escuro o amarelo cheio ofuscaria o texto claro: vira um marca-texto translúcido
  const marker = useTheme().palette.mode === 'dark' ? alpha(colors.highlight, 0.4) : colors.highlight;

  return (
    <Box
      component="header"
      sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 4 }}
    >
      <Box>
        <Typography
          variant="h1"
          component="h1"
          sx={{
            display: 'inline',
            // marca-texto sob a metade de baixo das letras
            backgroundImage: `linear-gradient(transparent 58%, ${marker} 58%, ${marker} 92%, transparent 92%)`,
            px: 0.5,
            mx: -0.5,
            boxDecorationBreak: 'clone',
            WebkitBoxDecorationBreak: 'clone',
          }}
        >
          {title}
        </Typography>
        {subtitle ? (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {actions ? <Box sx={{ display: 'flex', gap: 1.5 }}>{actions}</Box> : null}
    </Box>
  );
}
