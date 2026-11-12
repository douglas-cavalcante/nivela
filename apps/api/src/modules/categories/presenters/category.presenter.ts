import type { ApiCategory, SubjectColorKey } from '@nivela/api-contract';

export function presentCategory(
  category: {
    id: number;
    name: string;
    subject: { id: number; name: string; color: string };
  },
  questionsCount: number,
): ApiCategory {
  return {
    id: category.id,
    name: category.name,
    subject: {
      id: category.subject.id,
      name: category.subject.name,
      color: category.subject.color as SubjectColorKey,
    },
    questions_count: questionsCount,
  } satisfies ApiCategory;
}
