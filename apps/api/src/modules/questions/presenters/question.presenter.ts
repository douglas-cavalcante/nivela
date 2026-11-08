import { InternalServerErrorException, Logger } from '@nestjs/common';
import type {
  ApiQuestion,
  ApiQuestionSummary,
  Difficulty,
  OptionLetter,
  SubjectColorKey,
} from '@nivela/api-contract';

const EXCERPT_LENGTH = 140;
const logger = new Logger('QuestionPresenter');

/** Primeiros 140 caracteres do enunciado, sem quebras de linha. */
export function statementExcerpt(statement: string): string {
  const flat = statement.replace(/\s*[\r\n]+\s*/g, ' ');
  // Por pontos de código, para não partir emojis ao meio.
  const chars = Array.from(flat);
  return chars.length > EXCERPT_LENGTH
    ? `${chars.slice(0, EXCERPT_LENGTH).join('').trimEnd()}…`
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
  const correct = options.find((o) => o.isCorrect);
  if (!correct) {
    // Dado corrompido: nunca chuta uma alternativa correta.
    logger.error(`Questão ${row.id} sem alternativa correta.`);
    throw new InternalServerErrorException();
  }
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
    correct_letter: correct.letter as OptionLetter,
    options: options.map((o) => ({
      letter: o.letter as OptionLetter,
      text: o.text,
    })),
    can_edit: canEdit,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  } satisfies ApiQuestion;
}
