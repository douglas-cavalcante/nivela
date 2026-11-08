import { themes } from '@nivela/design-tokens';
import type { ThemeColors } from '@nivela/design-tokens';
import { useTheme } from '@mui/material/styles';

/** Cores do Caderno Vivo do tema atual (para estilos que vão além da paleta MUI). */
export function useNivelaColors(): ThemeColors {
  return themes[useTheme().palette.mode];
}
