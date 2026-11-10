import { dayNumber, studyDay } from 'src/shared/study/study-day';

describe('studyDay', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  it('conta 23h50 em Fortaleza como o dia anterior', () => {
    expect(studyDay(new Date('2026-11-10T02:50:00Z'))).toBe('2026-11-09');
  });

  it('vira o dia à meia-noite de Fortaleza (03h UTC)', () => {
    expect(studyDay(new Date('2026-11-10T03:10:00Z'))).toBe('2026-11-10');
    expect(studyDay(new Date('2026-11-10T02:59:59.999Z'))).toBe('2026-11-09');
  });

  it('não depende do fuso do processo', () => {
    for (const tz of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
      process.env.TZ = tz;
      expect(studyDay(new Date('2026-11-10T02:50:00Z'))).toBe('2026-11-09');
      expect(studyDay(new Date('2026-11-10T03:10:00Z'))).toBe('2026-11-10');
    }
  });
});

describe('dayNumber', () => {
  it('conta os dias desde 1970-01-01', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('1970-01-02')).toBe(1);
    expect(dayNumber('2026-11-10')).toBe(20767);
  });

  it('dias consecutivos diferem em 1, inclusive na virada de mês e ano', () => {
    expect(dayNumber('2026-12-01') - dayNumber('2026-11-30')).toBe(1);
    expect(dayNumber('2027-01-01') - dayNumber('2026-12-31')).toBe(1);
  });
});
