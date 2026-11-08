import { contrastRatio, subjectColorKeys, subjectColors, themes } from '@nivela/design-tokens';
import type { ThemeMode } from '@nivela/design-tokens';
import { subjectMarker, swatchBorder } from 'src/features/subjects/components/subjectStyles';

const modes: ThemeMode[] = ['light', 'dark'];

describe('contraste das disciplinas', () => {
  for (const mode of modes) {
    for (const key of subjectColorKeys) {
      it(`${mode}/${key}: texto sobre o marca-texto >= 4.5:1`, () => {
        expect(contrastRatio(themes[mode].text, subjectMarker(mode, key))).toBeGreaterThanOrEqual(4.5);
      });

      it(`${mode}/${key}: borda da bolinha >= 3:1 contra o fundo dela e o do diálogo`, () => {
        for (const checked of [false, true]) {
          const border = swatchBorder(mode, key, checked);
          expect(contrastRatio(border, subjectColors[mode][key].background)).toBeGreaterThanOrEqual(3);
          expect(contrastRatio(border, themes[mode].surface)).toBeGreaterThanOrEqual(3);
        }
      });
    }
  }
});
