import { Chip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Difficulty } from '@nivela/api-contract';
import { useNivelaColors } from 'src/lib/theme/useNivelaColors';

export const difficultyLabels: Record<Difficulty, string> = {
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
};

/** Dificuldade da questão: o texto leva a informação, a cor só reforça. */
export function DifficultyChip({ difficulty }: { difficulty: Difficulty }) {
  const colors = useNivelaColors();
  const tone =
    difficulty === 'easy'
      ? { color: 'success.main', borderColor: 'success.main', backgroundColor: 'transparent' }
      : difficulty === 'hard'
        ? { color: 'error.main', borderColor: 'error.main', backgroundColor: 'transparent' }
        : { color: 'text.primary', borderColor: 'text.secondary', backgroundColor: alpha(colors.highlight, 0.4) };
  return (
    <Chip
      size="small"
      variant="outlined"
      label={difficultyLabels[difficulty]}
      sx={{ ...tone, '& .MuiChip-label': { px: 1.25 } }}
    />
  );
}
