import { PrismaService } from 'src/prisma/prisma.service';

interface AttemptInput {
  studentId: number;
  questionId: number;
  /** Capítulo do plano; ausente = prática. */
  chapterId?: number;
  attemptNumber: 1 | 2;
  correct: boolean;
  at: Date | string;
}

/** Grava uma tentativa direto no banco, no instante informado (sem moedas). */
export async function createAttempt(
  prisma: PrismaService,
  input: AttemptInput,
) {
  const option = await prisma.questionOption.findFirstOrThrow({
    where: { questionId: input.questionId, isCorrect: input.correct },
  });
  return prisma.questionAttempt.create({
    data: {
      studentId: input.studentId,
      questionId: input.questionId,
      planChapterId: input.chapterId ?? null,
      selectedOptionId: option.id,
      attemptNumber: input.attemptNumber,
      isCorrect: input.correct,
      createdAt: new Date(input.at),
    },
  });
}
