import { themes } from '@nivela/design-tokens';
import type { ThemeColors, ThemeMode } from '@nivela/design-tokens';
import { createContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

/**
 * Nomes registrados em `useFonts` (app/_layout.tsx). No RN cada peso é uma família própria;
 * as famílias de `fonts` dos tokens (Caveat, Nunito) viram estes pesos.
 */
export const fontFamilies = {
  heading: 'Caveat_700Bold',
  body: 'Nunito_400Regular',
  bodyBold: 'Nunito_700Bold',
} as const;

export interface NivelaTheme {
  colors: ThemeColors;
  mode: ThemeMode;
  fonts: typeof fontFamilies;
}

export const ThemeContext = createContext<NivelaTheme | null>(null);

/** Segue o esquema claro/escuro do sistema. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const mode: ThemeMode = scheme === 'dark' ? 'dark' : 'light';
  const value = useMemo<NivelaTheme>(() => ({ colors: themes[mode], mode, fonts: fontFamilies }), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
