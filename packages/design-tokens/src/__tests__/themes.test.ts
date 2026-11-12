import { describe, expect, it } from 'vitest';
import { brand, contrastRatio, mascot, themes } from '../index';

const pairs = [
  ['text', 'background'],
  ['text', 'surface'],
  ['textMuted', 'surface'],
  ['onPrimary', 'primary'],
  ['onSecondary', 'secondary'],
  ['onHighlight', 'highlight'],
  ['onDanger', 'danger'],
  ['onSuccess', 'success'],
] as const;

describe('temas', () => {
  it.each(['light', 'dark'] as const)('tema %s respeita WCAG AA (≥ 4.5)', (mode) => {
    for (const [fg, bg] of pairs) {
      expect(contrastRatio(themes[mode][fg], themes[mode][bg])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('tema claro usa os valores fixos da marca', () => {
    expect(themes.light.background).toBe(brand.paper);
    expect(themes.light.text).toBe(brand.ink);
    expect(themes.light.primary).toBe(brand.tealDark);
    expect(themes.light.secondary).toBe(brand.coral);
    expect(themes.light.highlight).toBe(brand.highlighter);
  });

  it('mascote referencia só cores da marca', () => {
    for (const s of mascot.shapes) {
      expect(s.fill === 'none' || s.fill in brand).toBe(true);
      if (s.stroke) expect(s.stroke in brand).toBe(true);
    }
  });
});
