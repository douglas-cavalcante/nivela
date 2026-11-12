import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoinLedger } from 'src/shared/coins/coin-ledger';
import { isUniqueViolation } from 'src/shared/prisma/unique-violation';
import { StreakService } from 'src/shared/study/streak.service';
import { StudyModule } from 'src/shared/study/study.module';
import { createTestApp } from './helpers/create-test-app';
import { createQuestion, createUser } from './helpers/factories';
import { resetDatabase } from './helpers/reset-database';

describe('CoinLedger (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ledger = new CoinLedger();

  const correctAnswer = (studentId: number, sourceId: number) => ({
    studentId,
    amount: 10,
    reason: 'correct_answer' as const,
    sourceType: 'question',
    sourceId,
  });
  const balanceOf = async (studentId: number) =>
    (
      await prisma.studentProfile.findUniqueOrThrow({
        where: { userId: studentId },
      })
    ).coinsBalance;
  const rowsOf = (studentId: number) =>
    prisma.coinTransaction.count({ where: { studentId } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('o StudyModule expõe o extrato de moedas', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [StudyModule],
    }).compile();
    expect(moduleRef.get(CoinLedger)).toBeInstanceOf(CoinLedger);
    expect(moduleRef.get(StreakService)).toBeInstanceOf(StreakService);
  });

  it('credita: grava a linha e soma no saldo', async () => {
    const student = await createUser(prisma);
    const result = await prisma.$transaction((tx) =>
      ledger.credit(tx, correctAnswer(student.id, 1)),
    );
    expect(result).toEqual({ applied: true, balance: 10 });
    expect(await balanceOf(student.id)).toBe(10);
    expect(await rowsOf(student.id)).toBe(1);
  });

  it('crédito "uma vez" repetido devolve applied:false e não mexe no saldo', async () => {
    const student = await createUser(prisma);
    await prisma.$transaction((tx) =>
      ledger.credit(tx, correctAnswer(student.id, 1)),
    );
    const again = await prisma.$transaction((tx) =>
      ledger.credit(tx, correctAnswer(student.id, 1)),
    );
    expect(again).toEqual({ applied: false, balance: 10 });
    expect(await balanceOf(student.id)).toBe(10);
    expect(await rowsOf(student.id)).toBe(1);
  });

  it('duas chamadas na mesma transação creditam uma vez e a transação segue válida', async () => {
    const student = await createUser(prisma);
    const results = await prisma.$transaction(async (tx) => {
      const first = await ledger.credit(tx, correctAnswer(student.id, 1));
      const second = await ledger.credit(tx, correctAnswer(student.id, 1));
      // Se o segundo crédito tivesse abortado a transação, isto falharia.
      const other = await ledger.credit(tx, correctAnswer(student.id, 2));
      return [first, second, other];
    });
    expect(results.map((r) => r.applied)).toEqual([true, false, true]);
    expect(await balanceOf(student.id)).toBe(20);
    expect(await rowsOf(student.id)).toBe(2);
  });

  it('duas transações simultâneas da mesma questão creditam uma vez só', async () => {
    const student = await createUser(prisma);
    const results = await Promise.all([
      prisma.$transaction((tx) =>
        ledger.credit(tx, correctAnswer(student.id, 1)),
      ),
      prisma.$transaction((tx) =>
        ledger.credit(tx, correctAnswer(student.id, 1)),
      ),
    ]);
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    expect(await balanceOf(student.id)).toBe(10);
    expect(await rowsOf(student.id)).toBe(1);
  });

  const refund = (studentId: number, sourceId: number, amount = 30) => ({
    studentId,
    amount,
    reason: 'refund' as const,
    sourceType: 'redemption',
    sourceId,
  });

  it('estorno repetido do mesmo resgate credita uma vez só', async () => {
    const student = await createUser(prisma);
    const first = await prisma.$transaction((tx) =>
      ledger.credit(tx, refund(student.id, 5)),
    );
    const again = await prisma.$transaction((tx) =>
      ledger.credit(tx, refund(student.id, 5)),
    );
    expect(first).toEqual({ applied: true, balance: 30 });
    expect(again).toEqual({ applied: false, balance: 30 });
    expect(await rowsOf(student.id)).toBe(1);
  });

  it('dois estornos simultâneos do mesmo resgate: uma linha e saldo +preço uma vez', async () => {
    const student = await createUser(prisma);
    const results = await Promise.all([
      prisma.$transaction((tx) => ledger.credit(tx, refund(student.id, 5))),
      prisma.$transaction((tx) => ledger.credit(tx, refund(student.id, 5))),
    ]);
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    expect(await balanceOf(student.id)).toBe(30);
    expect(
      await prisma.coinTransaction.count({
        where: { studentId: student.id, reason: 'refund' },
      }),
    ).toBe(1);
  });

  it('resgates diferentes estornam cada um a sua vez', async () => {
    const student = await createUser(prisma);
    await prisma.$transaction(async (tx) => {
      await ledger.credit(tx, refund(student.id, 5));
      await ledger.credit(tx, refund(student.id, 6, 20));
    });
    expect(await balanceOf(student.id)).toBe(50);
  });

  it('a mesma origem vale uma vez por aluno e por motivo', async () => {
    const [a, b] = [await createUser(prisma), await createUser(prisma)];
    await prisma.$transaction(async (tx) => {
      await ledger.credit(tx, correctAnswer(a.id, 1));
      await ledger.credit(tx, correctAnswer(b.id, 1));
      await ledger.credit(tx, {
        studentId: a.id,
        amount: 50,
        reason: 'plan_completed',
        sourceType: 'plan',
        sourceId: 1,
      });
    });
    expect(await balanceOf(a.id)).toBe(60);
    expect(await balanceOf(b.id)).toBe(10);
  });

  it('o saldo bate com a soma do extrato', async () => {
    const student = await createUser(prisma);
    await prisma.$transaction(async (tx) => {
      await ledger.credit(tx, correctAnswer(student.id, 1));
      await ledger.credit(tx, correctAnswer(student.id, 2));
      await ledger.credit(tx, {
        studentId: student.id,
        amount: 5,
        reason: 'refund',
        sourceType: 'redemption',
        sourceId: 9,
      });
      await ledger.debit(tx, {
        studentId: student.id,
        amount: 15,
        reason: 'redemption',
        sourceType: 'reward',
        sourceId: 3,
      });
    });
    const sum = await prisma.coinTransaction.aggregate({
      where: { studentId: student.id },
      _sum: { amount: true },
    });
    expect(sum._sum.amount).toBe(10);
    expect(await balanceOf(student.id)).toBe(10);
  });

  it('débito sem saldo suficiente falha e não grava nada', async () => {
    const student = await createUser(prisma);
    await prisma.$transaction((tx) =>
      ledger.credit(tx, correctAnswer(student.id, 1)),
    );
    await expect(
      prisma.$transaction((tx) =>
        ledger.debit(tx, {
          studentId: student.id,
          amount: 11,
          reason: 'redemption',
          sourceType: 'reward',
          sourceId: 3,
        }),
      ),
    ).rejects.toThrow('Saldo insuficiente.');
    expect(await balanceOf(student.id)).toBe(10);
    expect(await rowsOf(student.id)).toBe(1);
  });

  it('o banco impede saldo negativo e lançamento zerado', async () => {
    const student = await createUser(prisma);
    await expect(
      prisma.studentProfile.update({
        where: { userId: student.id },
        data: { coinsBalance: { decrement: 1 } },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.coinTransaction.create({
        data: {
          studentId: student.id,
          amount: 0,
          reason: 'refund',
          sourceType: 'redemption',
          sourceId: 1,
        },
      }),
    ).rejects.toThrow();
  });

  it('isUniqueViolation reconhece os índices parciais num P2002 real', async () => {
    const student = await createUser(prisma);
    const base = {
      studentId: student.id,
      amount: 10,
      sourceType: 'x',
      sourceId: 1,
    };
    const cases = [
      ['correct_answer', 'coin_once_per_question'],
      ['plan_completed', 'coin_once_per_plan'],
      ['streak_bonus', 'coin_once_per_streak_day'],
      ['refund', 'coin_once_per_refund'],
    ] as const;
    for (const [reason, index] of cases) {
      await prisma.coinTransaction.create({ data: { ...base, reason } });
      const error: unknown = await prisma.coinTransaction
        .create({ data: { ...base, reason } })
        .catch((e: unknown) => e);
      expect(isUniqueViolation(error, index)).toBe(true);
      expect(isUniqueViolation(error, 'outro_indice')).toBe(false);
    }
  });
});

/** Repete `check` até dar verdadeiro (ou estourar o prazo, o que falha o teste). */
async function waitUntil(check: () => Promise<boolean>, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) {
      throw new Error('Condição não ocorreu a tempo.');
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe('StreakService (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const streak = new StreakService(new CoinLedger());
  const originalTz = process.env.TZ;

  const register = (studentId: number, now: string) =>
    prisma.$transaction((tx) => streak.register(tx, studentId, new Date(now)));

  beforeAll(async () => {
    // O servidor em UTC não pode mudar o dia de estudo.
    process.env.TZ = 'UTC';
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('23h50 e 00h10 em Fortaleza contam dias consecutivos; pular um dia zera', async () => {
    const student = await createUser(prisma);
    await register(student.id, '2026-11-10T02:50:00Z'); // 09/11 23h50
    const next = await register(student.id, '2026-11-10T03:10:00Z'); // 10/11 00h10
    expect(next).toEqual({ current: 2, best: 2, bonus_awarded: 0 });

    const skipped = await register(student.id, '2026-11-12T15:00:00Z');
    expect(skipped).toEqual({ current: 1, best: 2, bonus_awarded: 0 });

    const profile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: student.id },
    });
    expect(profile.lastStudyDate?.toISOString().slice(0, 10)).toBe(
      '2026-11-12',
    );
  });

  it('o bônus de 7 dias entra uma vez por marco, mesmo repetindo o dia ou em paralelo', async () => {
    const student = await createUser(prisma);
    for (let day = 1; day <= 6; day += 1) {
      await register(student.id, `2026-11-0${day}T15:00:00Z`);
    }
    const [a, b] = await Promise.all([
      register(student.id, '2026-11-07T15:00:00Z'),
      register(student.id, '2026-11-07T16:00:00Z'),
    ]);
    expect(a.current).toBe(7);
    expect(b.current).toBe(7);
    expect(a.bonus_awarded + b.bonus_awarded).toBe(20);

    const again = await register(student.id, '2026-11-07T20:00:00Z');
    expect(again.bonus_awarded).toBe(0);

    const profile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: student.id },
    });
    expect(profile.coinsBalance).toBe(20);
    expect(
      await prisma.coinTransaction.count({
        where: { studentId: student.id, reason: 'streak_bonus' },
      }),
    ).toBe(1);

    // O marco seguinte (14º dia) paga de novo.
    for (let day = 8; day <= 13; day += 1) {
      await register(
        student.id,
        `2026-11-${String(day).padStart(2, '0')}T15:00:00Z`,
      );
    }
    const fourteenth = await register(student.id, '2026-11-14T15:00:00Z');
    expect(fourteenth).toEqual({ current: 14, best: 14, bonus_awarded: 20 });
  });

  it('duas transações na virada do dia de Fortaleza não corrompem a sequência', async () => {
    const student = await createUser(prisma);
    await prisma.studentProfile.update({
      where: { userId: student.id },
      data: {
        currentStreak: 6,
        bestStreak: 6,
        lastStudyDate: new Date('2026-11-06T00:00:00Z'),
      },
    });
    // 06/11 foi o dia 6; 02:59:59Z de 08/11 ainda é dia 7 em Fortaleza.
    // Ordem forçada: A trava o perfil e segura a transação aberta até B
    // aparecer esperando o lock; só então A confirma. Assim B sempre lê o
    // estado gravado por A (nada depende de quem chega primeiro).
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let aHoldsLock!: () => void;
    const locked = new Promise<void>((resolve) => {
      aHoldsLock = resolve;
    });
    const a = prisma.$transaction(async (tx) => {
      const result = await streak.register(
        tx,
        student.id,
        new Date('2026-11-08T02:59:59Z'),
      );
      aHoldsLock();
      await barrier;
      return result;
    });
    await locked;
    const b = register(student.id, '2026-11-08T03:00:01Z');
    try {
      await waitUntil(async () => {
        const rows = await prisma.$queryRaw<{ waiting: number }[]>`
          SELECT count(*)::int AS waiting FROM pg_stat_activity
          WHERE datname = current_database()
            AND wait_event_type = 'Lock'
            AND query LIKE '%student_profiles%FOR UPDATE%'`;
        return rows[0].waiting > 0;
      });
    } finally {
      // Sem isto, uma falha da espera deixaria A segurando o lock para sempre.
      release();
    }
    const results = [await a, await b];
    expect(results[0]).toEqual({ current: 7, best: 7, bonus_awarded: 20 });
    expect(results[1]).toEqual({ current: 8, best: 8, bonus_awarded: 0 });
    const profile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: student.id },
    });
    expect(profile.currentStreak).toBe(8);
    expect(profile.bestStreak).toBe(8);
    expect(profile.lastStudyDate?.toISOString().slice(0, 10)).toBe(
      '2026-11-08',
    );
    expect(profile.coinsBalance).toBe(20);
    expect(
      await prisma.coinTransaction.count({
        where: { studentId: student.id, reason: 'streak_bonus' },
      }),
    ).toBe(1);
  });
});

describe('question_attempts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejeita alternativa que pertence a outra questão', async () => {
    await resetDatabase(prisma);
    const student = await createUser(prisma);
    const q1 = await createQuestion(prisma);
    const q2 = await createQuestion(prisma);
    const own = await prisma.questionOption.findFirstOrThrow({
      where: { questionId: q1.id },
    });
    const other = await prisma.questionOption.findFirstOrThrow({
      where: { questionId: q2.id },
    });
    const data = {
      studentId: student.id,
      questionId: q1.id,
      attemptNumber: 1,
      isCorrect: false,
    };
    await expect(
      prisma.questionAttempt.create({
        data: { ...data, selectedOptionId: other.id },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.questionAttempt.create({
        data: { ...data, selectedOptionId: own.id },
      }),
    ).resolves.toBeDefined();
  });
});
