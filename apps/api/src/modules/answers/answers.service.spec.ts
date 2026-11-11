import { NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { AnswersService } from 'src/modules/answers/answers.service';
import { AnswerDto } from 'src/modules/answers/dto/answer.dto';
import type { StudentPlansService } from 'src/modules/leveling-plans/student-plans.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import type { Clock } from 'src/shared/clock/clock';
import { CoinLedger } from 'src/shared/coins/coin-ledger';
import { Role } from 'src/shared/enums/role.enum';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';
import { StreakService } from 'src/shared/study/streak.service';

const student: AuthUser = {
  id: 7,
  name: 'Aluno',
  email: 'aluno@nivela.test',
  role: Role.Student,
};
const dto = (overrides: Partial<AnswerDto> = {}): AnswerDto => ({
  question_id: 10,
  selected_letter: 'A',
  ...overrides,
});
const options = ['A', 'B', 'C', 'D', 'E'].map((letter, index) => ({
  id: index + 1,
  letter,
  isCorrect: letter === 'A',
}));

/** P2002 no formato do Prisma 7 com adapter-pg. */
const uniqueViolation = (index: string) =>
  new Prisma.PrismaClientKnownRequestError('falha', {
    code: 'P2002',
    clientVersion: 'teste',
    meta: {
      driverAdapterError: {
        cause: { kind: 'UniqueConstraintViolation', constraint: { index } },
      },
    },
  });

describe('AnswersService', () => {
  const tx = {
    $queryRaw: jest.fn(),
    question: { findUniqueOrThrow: jest.fn() },
    questionAttempt: { findMany: jest.fn(), create: jest.fn() },
    studentProfile: { findUniqueOrThrow: jest.fn() },
  };
  const transaction = jest.fn((fn: (client: typeof tx) => Promise<unknown>) =>
    fn(tx),
  );
  const credit = jest.fn();
  const register = jest.fn();
  const enterChapter = jest.fn();
  const chapterHasQuestion = jest.fn();
  const completeAfterAnswer = jest.fn();
  const clock: Clock = { now: () => new Date('2026-11-10T15:00:00Z') };
  const service = new AnswersService(
    { $transaction: transaction } as unknown as PrismaService,
    { credit } as unknown as CoinLedger,
    { register } as unknown as StreakService,
    {
      enterChapter,
      chapterHasQuestion,
      completeAfterAnswer,
    } as unknown as StudentPlansService,
    clock,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    transaction.mockImplementation((fn) => fn(tx));
    tx.$queryRaw.mockResolvedValue([{ id: 10 }]);
    tx.question.findUniqueOrThrow.mockResolvedValue({
      explanation: 'Porque sim.',
      options,
    });
    tx.questionAttempt.findMany.mockResolvedValue([]);
    tx.questionAttempt.create.mockResolvedValue({ id: 1 });
    tx.studentProfile.findUniqueOrThrow.mockResolvedValue({ coinsBalance: 10 });
    credit.mockResolvedValue({ applied: true, balance: 10 });
    register.mockResolvedValue({ current: 1, best: 1, bonus_awarded: 0 });
  });

  it('acerto na 1ª credita 10 pelo extrato, registra a sequência e revela a correta', async () => {
    const result = await service.answer(student, dto());
    expect(credit).toHaveBeenCalledWith(tx, {
      studentId: 7,
      amount: 10,
      reason: 'correct_answer',
      sourceType: 'question',
      sourceId: 10,
    });
    expect(register).toHaveBeenCalledWith(tx, 7, clock.now());
    expect(tx.questionAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attemptNumber: 1,
          isCorrect: true,
          coinsAwarded: 10,
          planChapterId: null,
          selectedOptionId: 1,
        }) as unknown,
      }),
    );
    expect(result).toMatchObject({
      finished: true,
      coins_awarded: 10,
      correct_letter: 'A',
      explanation: 'Porque sim.',
    });
  });

  it('acerto na 2ª credita 5; crédito já aplicado antes vira coins_awarded 0', async () => {
    tx.questionAttempt.findMany.mockResolvedValue([{ isCorrect: false }]);
    await service.answer(student, dto());
    expect(credit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ amount: 5 }),
    );

    credit.mockResolvedValue({ applied: false, balance: 10 });
    const again = await service.answer(student, dto());
    expect(again.coins_awarded).toBe(0);
  });

  it('erro na 1ª: sem crédito e sem revelar a correta nem a explicação', async () => {
    const result = await service.answer(student, dto({ selected_letter: 'B' }));
    expect(credit).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      is_correct: false,
      finished: false,
      correct_letter: null,
      explanation: null,
    });
  });

  it('já terminada (acertou ou 2 tentativas) responde 409 sem gravar', async () => {
    for (const previous of [
      [{ isCorrect: true }],
      [{ isCorrect: false }, { isCorrect: false }],
    ]) {
      tx.questionAttempt.findMany.mockResolvedValue(previous);
      await expect(service.answer(student, dto())).rejects.toThrow(
        new BusinessRuleException('Você já terminou esta questão.'),
      );
    }
    expect(tx.questionAttempt.create).not.toHaveBeenCalled();
    expect(credit).not.toHaveBeenCalled();
  });

  it('questão inexistente ou inativa responde 404', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(service.answer(student, dto())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('com capítulo: trava o plano depois do perfil, grava a tentativa no capítulo e devolve chapter/plan', async () => {
    enterChapter.mockResolvedValue({ planId: 4 });
    chapterHasQuestion.mockResolvedValue(true);
    const completion = {
      chapter: { completed: true, next_chapter_id: null },
      plan: { completed: true, bonus_awarded: 50 },
    };
    completeAfterAnswer.mockResolvedValue(completion);
    const result = await service.answer(student, dto({ plan_chapter_id: 3 }));
    expect(enterChapter).toHaveBeenCalledWith(tx, 7, 3);
    expect(chapterHasQuestion).toHaveBeenCalledWith(tx, 3, 10);
    expect(completeAfterAnswer).toHaveBeenCalledWith(tx, 7, 4, 3);
    expect(tx.questionAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ planChapterId: 3 }) as unknown,
      }),
    );
    expect(result).toMatchObject(completion);
  });

  it('com capítulo: questão fora do capítulo responde 404 sem gravar', async () => {
    enterChapter.mockResolvedValue({ planId: 4 });
    chapterHasQuestion.mockResolvedValue(false);
    await expect(
      service.answer(student, dto({ plan_chapter_id: 3 })),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.questionAttempt.create).not.toHaveBeenCalled();
  });

  it('na prática livre não toca nos planos e não devolve chapter/plan', async () => {
    const result = await service.answer(student, dto());
    expect(enterChapter).not.toHaveBeenCalled();
    expect(completeAfterAnswer).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('chapter');
    expect(result).not.toHaveProperty('plan');
  });

  it('corrida que escapa da pré-checagem (P2002 do índice parcial) vira 409; outros erros passam', async () => {
    for (const index of [
      'question_attempts_practice_key',
      'question_attempts_chapter_key',
    ]) {
      transaction.mockRejectedValueOnce(uniqueViolation(index));
      await expect(service.answer(student, dto())).rejects.toThrow(
        new BusinessRuleException('Você já terminou esta questão.'),
      );
    }
    const other = uniqueViolation('outro_indice');
    transaction.mockRejectedValueOnce(other);
    await expect(service.answer(student, dto())).rejects.toBe(other);
  });
});
