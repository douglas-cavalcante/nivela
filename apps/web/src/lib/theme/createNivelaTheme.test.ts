import { fonts, themes } from '@nivela/design-tokens';
import { createNivelaTheme } from 'src/lib/theme/createNivelaTheme';

describe('createNivelaTheme', () => {
  it.each(['light', 'dark'] as const)('usa as cores do tema %s', (mode) => {
    const theme = createNivelaTheme(mode);
    expect(theme.palette.mode).toBe(mode);
    expect(theme.palette.primary.main).toBe(themes[mode].primary);
    expect(theme.palette.background.default).toBe(themes[mode].background);
    expect(theme.palette.text.primary).toBe(themes[mode].text);
  });

  it('usa Caveat nos títulos e Nunito no texto', () => {
    const theme = createNivelaTheme('light');
    expect(theme.typography.h1.fontFamily).toContain(fonts.heading);
    expect(theme.typography.h4.fontFamily).toContain(fonts.heading);
    expect(theme.typography.fontFamily).toContain(fonts.body);
    expect(theme.typography.body1.fontFamily).toContain(fonts.body);
  });
});
