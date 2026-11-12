import {
  SUBJECT_COLOR_KEYS,
  SUBJECT_ICON_KEYS,
} from 'src/modules/subjects/subject-keys';

describe('subject-keys', () => {
  it('lista 6 cores e 6 ícones sem repetição', () => {
    expect(new Set(SUBJECT_COLOR_KEYS).size).toBe(6);
    expect(new Set(SUBJECT_ICON_KEYS).size).toBe(6);
  });
});
