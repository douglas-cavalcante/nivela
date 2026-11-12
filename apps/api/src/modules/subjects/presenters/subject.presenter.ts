import type {
  ApiSubject,
  SubjectColorKey,
  SubjectIconKey,
} from '@nivela/api-contract';

export function presentSubject(
  subject: {
    id: number;
    name: string;
    color: string;
    icon: string;
    _count: { categories: number };
  },
  questionsCount: number,
): ApiSubject {
  return {
    id: subject.id,
    name: subject.name,
    color: subject.color as SubjectColorKey,
    icon: subject.icon as SubjectIconKey,
    categories_count: subject._count.categories,
    questions_count: questionsCount,
  } satisfies ApiSubject;
}
