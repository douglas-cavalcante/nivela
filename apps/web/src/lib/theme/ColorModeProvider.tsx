import { CssBaseline, ThemeProvider } from '@mui/material';
import type { ThemeMode } from '@nivela/design-tokens';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createNivelaTheme } from 'src/lib/theme/createNivelaTheme';

const STORAGE_KEY = 'nivela.theme';

interface ColorModeValue {
  mode: ThemeMode;
  toggleMode: () => void;
}

const ColorModeContext = createContext<ColorModeValue | null>(null);

function readInitialMode(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // localStorage indisponível: usa a preferência do sistema
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Aplica o tema MUI (claro/escuro), lembra a escolha e expõe `useColorMode()`. */
export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readInitialMode);
  const theme = useMemo(() => createNivelaTheme(mode), [mode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // sem persistência: a escolha vale só nesta sessão
    }
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const toggleMode = useCallback(() => setMode((current) => (current === 'light' ? 'dark' : 'light')), []);
  const value = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export function useColorMode(): ColorModeValue {
  const value = useContext(ColorModeContext);
  if (!value) throw new Error('useColorMode precisa estar dentro de ColorModeProvider.');
  return value;
}
