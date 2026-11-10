import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoinLedger } from 'src/shared/coins/coin-ledger';
import { isUniqueViolation } from 'src/shared/prisma/unique-violation';
import { StudyModule } from 'src/shared/study/study.module';
import { createTestApp } from './helpers/create-test-app';
import { createUser } from './helpers/factories';
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
