import {
  accuracyOf,
  shiftDay,
  windowBounds,
} from 'src/modules/dashboard/attempt-contexts';

describe('accuracyOf', () => {
  it('arredonda para porcentagem inteira e devolve null sem terminadas', () => {
    expect(accuracyOf(2, 3)).toBe(67);
    expect(accuracyOf(1, 3)).toBe(33);
    expect(accuracyOf(0, 4)).toBe(0);
    expect(accuracyOf(4, 4)).toBe(100);
    expect(accuracyOf(0, 0)).toBeNull();
  });
});

describe('shiftDay', () => {
  it('anda em dias de calendário, inclusive na virada de mês e ano', () => {
    expect(shiftDay('2026-11-10', -29)).toBe('2026-10-12');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('windowBounds', () => {
  it('cobre hoje e os 29 dias anteriores em dias de estudo de Fortaleza', () => {
    // 00h10 de 10/11 em Fortaleza ainda é 10/11; 23h50 de 09/11 é dia 09.
    expect(windowBounds(new Date('2026-11-10T03:10:00Z'))).toEqual({
      from: '2026-10-12',
      to: '2026-11-10',
    });
    expect(windowBounds(new Date('2026-11-10T02:50:00Z'))).toEqual({
      from: '2026-10-11',
      to: '2026-11-09',
    });
  });
});
