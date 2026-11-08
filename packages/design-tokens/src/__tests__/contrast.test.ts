import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../contrast';

describe('contrastRatio', () => {
  it('calcula contraste WCAG', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#23313F', '#FFFDF6')).toBeGreaterThan(12);
  });
});
