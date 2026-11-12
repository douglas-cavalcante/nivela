import type { Prisma } from 'src/generated/prisma/client';
import type { CoinLedger } from 'src/shared/coins/coin-ledger';
import { StreakService } from 'src/shared/study/streak.service';

interface Profile {
  currentStreak: number;
  bestStreak: number;
  lastStudyDate: Date | null;
}

interface CreditInput {
  sourceId: number;
  amount: number;
}

function setup(initial?: Partial<Profile>) {
  const profile: Profile = {
    currentStreak: 0,
    bestStreak: 0,
    lastStudyDate: null,
    ...initial,
  };
  const tx = {
    $queryRaw: jest.fn(() =>
      Promise.resolve([
        {
          current_streak: profile.currentStreak,
          best_streak: profile.bestStreak,
          last_study_date: profile.lastStudyDate,
        },
      ]),
    ),
    studentProfile: {
      update: jest.fn(({ data }: { data: Partial<Profile> }) => {
        Object.assign(profile, data);
        return Promise.resolve({ ...profile });
      }),
    },
  } as unknown as Prisma.TransactionClient;

  // Simula o extrato: o mesmo dia de bônus só entra uma vez.
  const credited = new Set<number>();
  const credit = jest.fn((_tx: unknown, input: CreditInput) => {
    const applied = !credited.has(input.sourceId);
    credited.add(input.sourceId);
    return Promise.resolve({ applied, balance: 0 });
  });
  const service = new StreakService({ credit } as unknown as CoinLedger);
  return { service, tx, credit, profile };
}

/** Meio-dia em Fortaleza (15h UTC) do dia informado. */
const at = (day: string) => new Date(`${day}T15:00:00Z`);

describe('StreakService', () => {
  it('começa em 1 no primeiro dia de estudo', async () => {
    const { service, tx } = setup();
    await expect(service.register(tx, 1, at('2026-11-01'))).resolves.toEqual({
      current: 1,
      best: 1,
      bonus_awarded: 0,
    });
  });

  it('sobe nos dias consecutivos', async () => {
    const { service, tx } = setup();
    await service.register(tx, 1, at('2026-11-01'));
    await service.register(tx, 1, at('2026-11-02'));
    const result = await service.register(tx, 1, at('2026-11-03'));
    expect(result).toMatchObject({ current: 3, best: 3 });
  });

  it('no mesmo dia não muda nada', async () => {
    const { service, tx, profile } = setup();
    await service.register(tx, 1, at('2026-11-01'));
    await service.register(tx, 1, at('2026-11-02'));
    const result = await service.register(tx, 1, at('2026-11-02'));
    expect(result).toEqual({ current: 2, best: 2, bonus_awarded: 0 });
    expect(profile.currentStreak).toBe(2);
  });

  it('pular um dia volta a 1 e preserva o melhor', async () => {
    const { service, tx } = setup();
    await service.register(tx, 1, at('2026-11-01'));
    await service.register(tx, 1, at('2026-11-02'));
    await service.register(tx, 1, at('2026-11-03'));
    const result = await service.register(tx, 1, at('2026-11-05'));
    expect(result).toEqual({ current: 1, best: 3, bonus_awarded: 0 });
  });

  it('23h50 e 00h10 em Fortaleza contam dias consecutivos', async () => {
    const { service, tx } = setup();
    await service.register(tx, 1, new Date('2026-11-10T02:50:00Z'));
    const result = await service.register(
      tx,
      1,
      new Date('2026-11-10T03:10:00Z'),
    );
    expect(result.current).toBe(2);
  });

  it('credita 20 moedas no 7º dia, uma vez só', async () => {
    const { service, tx, credit } = setup();
    for (let d = 1; d <= 6; d += 1) {
      const result = await service.register(tx, 7, at(`2026-11-0${d}`));
      expect(result.bonus_awarded).toBe(0);
    }
    expect(credit).not.toHaveBeenCalled();

    const seventh = await service.register(tx, 7, at('2026-11-07'));
    expect(seventh).toEqual({ current: 7, best: 7, bonus_awarded: 20 });
    expect(credit).toHaveBeenCalledTimes(1);
    expect(credit).toHaveBeenCalledWith(tx, {
      studentId: 7,
      amount: 20,
      reason: 'streak_bonus',
      sourceType: 'study_day',
      sourceId: 20764,
    });

    const again = await service.register(tx, 7, at('2026-11-07'));
    expect(again).toEqual({ current: 7, best: 7, bonus_awarded: 0 });
    expect(credit).toHaveBeenCalledTimes(1);
  });

  it('não informa bônus quando o extrato já tinha o marco', async () => {
    const { service, tx, credit } = setup({
      currentStreak: 6,
      bestStreak: 6,
      lastStudyDate: new Date('2026-11-06T00:00:00Z'),
    });
    credit.mockResolvedValueOnce({ applied: false, balance: 0 });
    const result = await service.register(tx, 1, at('2026-11-07'));
    expect(result).toEqual({ current: 7, best: 7, bonus_awarded: 0 });
  });

  describe('effective (Ruling 10: leitura da sequência)', () => {
    const { service } = setup();
    const stored = (lastStudyDate: string | null) => ({
      currentStreak: 4,
      bestStreak: 9,
      lastStudyDate: lastStudyDate
        ? new Date(`${lastStudyDate}T00:00:00Z`)
        : null,
    });

    it('estudou hoje ou ontem (em Fortaleza): mantém a gravada', () => {
      expect(service.effective(stored('2026-11-10'), at('2026-11-10'))).toEqual(
        {
          current: 4,
          best: 9,
        },
      );
      expect(service.effective(stored('2026-11-09'), at('2026-11-10'))).toEqual(
        {
          current: 4,
          best: 9,
        },
      );
    });

    it('último estudo há mais de 1 dia: current 0 e best preservado', () => {
      expect(service.effective(stored('2026-11-07'), at('2026-11-10'))).toEqual(
        {
          current: 0,
          best: 9,
        },
      );
    });

    it('usa o dia de Fortaleza: 23h59 do dia seguinte ainda vale; 00h01 do outro zera', () => {
      const profile = stored('2026-11-09');
      // 2026-11-11T02:59Z = 23h59 de 10/11 em Fortaleza.
      expect(
        service.effective(profile, new Date('2026-11-11T02:59:00Z')).current,
      ).toBe(4);
      // 2026-11-11T03:01Z = 00h01 de 11/11 em Fortaleza.
      expect(
        service.effective(profile, new Date('2026-11-11T03:01:00Z')).current,
      ).toBe(0);
    });

    it('sem estudo registrado: 0', () => {
      expect(
        service.effective(
          { currentStreak: 0, bestStreak: 0, lastStudyDate: null },
          at('2026-11-10'),
        ),
      ).toEqual({ current: 0, best: 0 });
    });
  });
});
