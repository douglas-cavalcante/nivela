import { NotFoundException } from '@nestjs/common';
import type { Prisma } from 'src/generated/prisma/client';
import { CoinLedger, lockStudentProfile } from 'src/shared/coins/coin-ledger';

function fakeTx(inserted: number, balance = 10, profileExists = true) {
  const executeRaw = jest.fn(() => Promise.resolve(inserted));
  // O lock do perfil (`FOR UPDATE`) devolve a linha se o perfil existe; o
  // UPDATE do débito devolve o saldo se a linha mudou.
  const queryRaw = jest.fn((strings: TemplateStringsArray) =>
    Promise.resolve(
      strings.join('').includes('FOR UPDATE')
        ? profileExists
          ? [{ user_id: 1 }]
          : []
        : inserted
          ? [{ coins_balance: balance }]
          : [],
    ),
  );
  const update = jest.fn(() => Promise.resolve({ coinsBalance: balance }));
  const findUniqueOrThrow = jest.fn(() =>
    Promise.resolve({ coinsBalance: balance }),
  );
  const create = jest.fn(() => Promise.resolve({}));
  const tx = {
    $executeRaw: executeRaw,
    $queryRaw: queryRaw,
    coinTransaction: { create },
    studentProfile: { update, findUniqueOrThrow },
  } as unknown as Prisma.TransactionClient;
  return { tx, update, findUniqueOrThrow, create, executeRaw };
}

const input = {
  studentId: 1,
  amount: 10,
  reason: 'correct_answer' as const,
  sourceType: 'question',
  sourceId: 5,
};

describe('CoinLedger', () => {
  const ledger = new CoinLedger();

  it('credita e devolve o saldo novo quando a linha entra', async () => {
    const { tx, update } = fakeTx(1, 10);
    await expect(ledger.credit(tx, input)).resolves.toEqual({
      applied: true,
      balance: 10,
    });
    expect(update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { coinsBalance: { increment: 10 } },
      select: { coinsBalance: true },
    });
  });

  it('não mexe no saldo quando o crédito único já existia', async () => {
    const { tx, update, findUniqueOrThrow } = fakeTx(0, 30);
    await expect(ledger.credit(tx, input)).resolves.toEqual({
      applied: false,
      balance: 30,
    });
    expect(update).not.toHaveBeenCalled();
    expect(findUniqueOrThrow).toHaveBeenCalled();
  });

  it('recusa valor que não seja inteiro positivo', async () => {
    const { tx } = fakeTx(1);
    await expect(ledger.credit(tx, { ...input, amount: 0 })).rejects.toThrow();
    await expect(ledger.credit(tx, { ...input, amount: -5 })).rejects.toThrow();
    await expect(
      ledger.credit(tx, { ...input, amount: 1.5 }),
    ).rejects.toThrow();
  });

  it('débito sem saldo suficiente falha com a regra de negócio', async () => {
    const { tx, create } = fakeTx(0);
    await expect(
      ledger.debit(tx, {
        studentId: 1,
        amount: 50,
        reason: 'redemption',
        sourceType: 'reward',
        sourceId: 3,
      }),
    ).rejects.toThrow('Saldo insuficiente.');
    expect(create).not.toHaveBeenCalled();
  });

  it('perfil inexistente: lockStudentProfile responde 404 "Aluno não encontrado." antes de qualquer gravação', async () => {
    const { tx, update, create, executeRaw } = fakeTx(1, 10, false);
    await expect(lockStudentProfile(tx, 99)).rejects.toThrow(
      new NotFoundException('Aluno não encontrado.'),
    );
    await expect(ledger.credit(tx, input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      ledger.debit(tx, {
        studentId: 99,
        amount: 5,
        reason: 'redemption',
        sourceType: 'redemption',
        sourceId: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(executeRaw).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
