import { Box, Card, CardContent, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Outlet } from 'react-router';
import { Mascot } from 'src/components/Mascot';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

/** Altura da linha da pauta dentro da folha (px). */
const RULE_STEP = 32;

/** Moldura das telas públicas (login etc.): uma folha pautada, com margem, no centro do caderno. */
export function AuthLayout() {
  const colors = useNivelaColors();
  const marker = useTheme().palette.mode === 'dark' ? alpha(colors.highlight, 0.4) : colors.highlight;

  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Card
        sx={{
          width: '100%',
          maxWidth: 440,
          position: 'relative',
          overflow: 'hidden',
          // pauta da folha e linha vermelha da margem à esquerda
          backgroundImage: (theme) =>
            `linear-gradient(to right, transparent 15px, ${alpha(theme.palette.secondary.main, 0.7)} 15px, ${alpha(theme.palette.secondary.main, 0.7)} 17px, transparent 17px), repeating-linear-gradient(to bottom, transparent 0, transparent ${RULE_STEP - 1}px, ${theme.palette.divider} ${RULE_STEP - 1}px, ${theme.palette.divider} ${RULE_STEP}px)`,
          backgroundPosition: '0 0, 0 12px',
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4.5 }, pl: { xs: 4, sm: 6 } }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              mb: 3.5,
            }}
          >
            <Mascot size={88} />
            <Typography
              variant="h1"
              component="p"
              sx={{
                lineHeight: 1,
                px: 1,
                // marca-texto sob a metade de baixo das letras
                backgroundImage: `linear-gradient(transparent 58%, ${marker} 58%, ${marker} 90%, transparent 90%)`,
              }}
            >
              Nivela
            </Typography>
          </Box>
          <Outlet />
        </CardContent>
      </Card>
    </Box>
  );
}
