import type { ApiTeacher } from '@nivela/api-contract';

export function presentTeacher(teacher: {
  id: number;
  name: string;
  email: string;
  active: boolean;
  createdAt: Date;
  _count: { classrooms: number };
}): ApiTeacher {
  return {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    active: teacher.active,
    classrooms_count: teacher._count.classrooms,
    created_at: teacher.createdAt.toISOString(),
  } satisfies ApiTeacher;
}
