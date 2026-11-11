import { Box } from '@mui/material';
import { penShadow } from '@nivela/design-tokens';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

interface ChapterProgressBarProps {
  completed: number;
  total: number;
  /** Nome acessível da barra (ex.: "Capítulos concluídos por Ana"). */
  label: string;
}

/** Barra de capítulos concluídos, no traço de caneta do Caderno Vivo; plano sem capítulos fica vazia. */
export function ChapterProgressBar({ completed, total, label }: ChapterProgressBarProps) {
  const colors = useNivelaColors();
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return (
    <Box
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completed}
      sx={{
        width: '100%',
        minWidth: 80,
        height: 12,
        overflow: 'hidden',
        borderRadius: 6,
        border: `${penShadow.width}px solid ${colors.border}`,
        backgroundColor: colors.rule,
      }}
    >
      <Box sx={{ width: `${percent}%`, height: '100%', backgroundColor: colors.primary }} />
    </Box>
  );
}
