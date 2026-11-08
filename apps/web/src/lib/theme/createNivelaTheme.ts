import { fonts, penShadow, radius, themes } from '@nivela/design-tokens';
import type { ThemeMode } from '@nivela/design-tokens';
import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

const headingFont = `"${fonts.heading}", "Comic Sans MS", cursive`;
const bodyFont = `"${fonts.body}", system-ui, -apple-system, "Segoe UI", sans-serif`;

/** Altura da linha da pauta do caderno (px). O texto base usa a mesma medida. */
const RULE_STEP = 32;

/** Tema MUI "Caderno Vivo" gerado a partir dos design tokens. */
export function createNivelaTheme(mode: ThemeMode): Theme {
  const c = themes[mode];
  const pen = `${penShadow.offset}px ${penShadow.offset}px 0 ${c.shadow}`;
  const penSmall = `1px 1px 0 ${c.shadow}`;
  const border = `${penShadow.width}px solid ${c.border}`;
  const focus = { outline: `3px solid ${c.highlight}`, outlineOffset: 2 };

  return createTheme({
    cssVariables: false,
    palette: {
      mode,
      primary: { main: c.primary, contrastText: c.onPrimary },
      secondary: { main: c.secondary, contrastText: c.onSecondary },
      error: { main: c.danger, contrastText: c.onDanger },
      success: { main: c.success, contrastText: c.onSuccess },
      background: { default: c.background, paper: c.surface },
      text: { primary: c.text, secondary: c.textMuted },
      divider: c.rule,
    },
    shape: { borderRadius: radius.md },
    typography: {
      fontFamily: bodyFont,
      fontWeightBold: 800,
      h1: { fontFamily: headingFont, fontWeight: 700, fontSize: '3rem', lineHeight: 1.1 },
      h2: { fontFamily: headingFont, fontWeight: 700, fontSize: '2.5rem', lineHeight: 1.15 },
      h3: { fontFamily: headingFont, fontWeight: 700, fontSize: '2rem', lineHeight: 1.2 },
      h4: { fontFamily: headingFont, fontWeight: 700, fontSize: '1.75rem', lineHeight: 1.2 },
      h5: { fontFamily: bodyFont, fontWeight: 800, fontSize: '1.25rem' },
      h6: { fontFamily: bodyFont, fontWeight: 800, fontSize: '1.05rem' },
      subtitle1: { fontFamily: bodyFont, fontWeight: 600 },
      body1: { fontFamily: bodyFont },
      body2: { fontFamily: bodyFont },
      button: { fontFamily: bodyFont, fontWeight: 800, textTransform: 'none' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: c.background,
            // pauta de caderno: uma linha fina a cada RULE_STEP px
            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${RULE_STEP - 1}px, ${c.rule} ${RULE_STEP - 1}px, ${c.rule} ${RULE_STEP}px)`,
            lineHeight: 1.6,
          },
          '::selection': { backgroundColor: c.highlight, color: c.onHighlight },
          ':focus-visible': focus,
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { border, borderRadius: radius.lg, boxShadow: pen, backgroundColor: c.surface, backgroundImage: 'none' },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            border,
            borderRadius: radius.md,
            paddingInline: 18,
            minHeight: 44,
            boxShadow: pen,
            transition: 'transform 80ms ease, box-shadow 80ms ease',
            '&:hover': { boxShadow: pen, transform: 'translate(-1px, -1px)' },
            '&:active': { boxShadow: penSmall, transform: 'translate(2px, 2px)' },
            '&.Mui-focusVisible': focus,
            '&.Mui-disabled': { boxShadow: 'none', borderColor: c.rule },
          },
          text: { border: '2px solid transparent', boxShadow: 'none', '&:hover': { boxShadow: 'none', transform: 'none' } },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { '&.Mui-focusVisible': focus } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: c.surface,
            borderRadius: radius.md,
            '& .MuiOutlinedInput-notchedOutline': { borderWidth: penShadow.width, borderColor: c.border },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: c.primary, borderWidth: penShadow.width },
            // erro vence o foco: o campo com problema continua vermelho mesmo com o cursor nele
            '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: c.danger },
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 700, border: `1px solid ${c.border}` } },
      },
      MuiTooltip: {
        styleOverrides: { tooltip: { backgroundColor: c.text, color: c.background, fontWeight: 600 } },
      },
    },
  });
}
