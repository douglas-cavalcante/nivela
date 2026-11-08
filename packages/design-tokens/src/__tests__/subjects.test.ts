import { describe, expect, it } from 'vitest';
import { contrastRatio, subjectColorKeys, subjectColors, subjectIconKeys } from '../index';

const modes = ['light', 'dark'] as const;

describe('cores de disciplina', () => {
  it.each(modes.flatMap((mode) => subjectColorKeys.map((key) => [mode, key] as const)))(
    'tema %s, cor %s respeita WCAG AA (≥ 4.5)',
    (mode, key) => {
      const { foreground, background } = subjectColors[mode][key];
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('tem as mesmas cores nos dois temas', () => {
    expect(Object.keys(subjectColors.light).sort()).toEqual([...subjectColorKeys].sort());
    expect(Object.keys(subjectColors.dark).sort()).toEqual([...subjectColorKeys].sort());
  });

  it('lista 6 cores e 6 ícones sem repetição', () => {
    expect(subjectColorKeys).toHaveLength(6);
    expect(new Set(subjectColorKeys).size).toBe(6);
    expect(subjectIconKeys).toHaveLength(6);
    expect(new Set(subjectIconKeys).size).toBe(6);
  });
});
