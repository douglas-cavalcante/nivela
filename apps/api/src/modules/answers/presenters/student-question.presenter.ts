import type {
  ApiStudentQuestion,
  Difficulty,
  OptionLetter,
  SubjectColorKey,
} from '@nivela/api-contract';
import type { Prisma } from 'src/generated/prisma/client';

/**
 * RN05: a questão do aluno tem select próprio. `explanation` e
 * `options.isCorrect` nunca saem do banco para este payload, então nem um
 * descuido no presenter consegue vazar a resposta.
 */
export const STUDENT_QUESTION_SELECT = {
  id: true,
  statement: true,
  imagePath: true,
  difficulty: true,
  subject: { select: { id: true, name: true, color: true } },
  category: { select: { id: true, name: true } },
  options: { select: { letter: true, text: true }, orderBy: { letter: 'asc' } },
} satisfies Prisma.QuestionSelect;

export type StudentQuestionRow = Prisma.QuestionGetPayload<{
  select: typeof STUDENT_QUESTION_SELECT;
}>;

export function presentStudentQuestion(
  row: StudentQuestionRow,
  imageUrl: string | null,
  attemptsLeft: 1 | 2,
): ApiStudentQuestion {
  return {
    id: row.id,
    statement: row.statement,
    image_url: imageUrl,
    difficulty: row.difficulty as Difficulty,
    subject: {
      id: row.subject.id,
      name: row.subject.name,
      color: row.subject.color as SubjectColorKey,
    },
    category: { id: row.category.id, name: row.category.name },
    options: row.options.map((option) => ({
      letter: option.letter as OptionLetter,
      text: option.text,
    })),
    attempts_left: attemptsLeft,
  } satisfies ApiStudentQuestion;
}
