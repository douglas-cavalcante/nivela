import { useContext } from 'react';
import { ThemeContext } from 'src/lib/theme/ThemeProvider';
import type { NivelaTheme } from 'src/lib/theme/ThemeProvider';

export function useTheme(): NivelaTheme {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme precisa estar dentro de ThemeProvider.');
  return value;
}
