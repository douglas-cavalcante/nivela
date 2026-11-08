import type {
  ApiQuestion,
  ApiQuestionSummary,
  Difficulty,
  OptionLetter,
  SubjectColorKey,
} from '@nivela/api-contract';

const EXCERPT_LENGTH = 140;

/** Primeiros 140 caracteres do enunciado, sem quebras de linha. */
export function statementExcerpt(statement: string): string {
  const flat = statement.replace(/\s*[\r\n]+\s*/g, ' ');
  return flat.length > EXCERPT_LENGTH
    ? `${flat.slice(0, EXCERPT_LENGTH)}…`
    : flat;
}

interface QuestionRow {
  id: number;
  authorId: number;
  statement: string;
  imagePath: string | null;
  difficulty: string;
  explanation: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  subject: { id: number; name: string; color: string };
  category: { id: number; name: string };
  author: { id: number; name: string };
}

export interface QuestionWithOptions extends QuestionRow {
  options: Array<{ letter: string; text: string; isCorrect: boolean }>;
}

export function presentQuestionSummary(row: QuestionRow): ApiQuestionSummary {
  return {
    id: row.id,
    statement_excerpt: statementExcerpt(row.statement),
    difficulty: row.difficulty as Difficulty,
    active: row.active,
    has_image: row.imagePath !== null,
    subject: {
      id: row.subject.id,
      name: row.subject.name,
      color: row.subject.color as SubjectColorKey,
    },
    category: { id: row.category.id, name: row.category.name },
    author: { id: row.author.id, name: row.author.name },
    updated_at: row.updatedAt.toISOString(),
  } satisfies ApiQuestionSummary;
}

export function presentQuestion(
  row: QuestionWithOptions,
  imageUrl: string | null,
  canEdit: boolean,
): ApiQuestion {
  const options = [...row.options].sort((a, b) =>
    a.letter.localeCompare(b.letter),
  );
  return {
    id: row.id,
    statement: row.statement,
    explanation: row.explanation,
    image_url: imageUrl,
    difficulty: row.difficulty as Difficulty,
    active: row.active,
    subject: {
      id: row.subject.id,
      name: row.subject.name,
      color: row.subject.color as SubjectColorKey,
    },
    category: { id: row.category.id, name: row.category.name },
    author: { id: row.author.id, name: row.author.name },
    correct_letter: (options.find((o) => o.isCorrect)?.letter ??
      'A') as OptionLetter,
    options: options.map((o) => ({
      letter: o.letter as OptionLetter,
      text: o.text,
    })),
    can_edit: canEdit,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  } satisfies ApiQuestion;
}
