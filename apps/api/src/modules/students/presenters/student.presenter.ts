import type { ApiStudent, ApiStudentSummary } from '@nivela/api-contract';

interface StudentRow {
  id: number;
  name: string;
  email: string;
  active: boolean;
  createdAt: Date;
  studentProfile: {
    coinsBalance: number;
    currentStreak: number;
    bestStreak: number;
  } | null;
  /** Só as matrículas que quem consulta pode ver. */
  enrollments: Array<{ classroom: { id: number; name: string } }>;
}

export function presentStudentSummary(student: StudentRow): ApiStudentSummary {
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    active: student.active,
    classrooms: student.enrollments.map(({ classroom }) => ({
      id: classroom.id,
      name: classroom.name,
    })),
    coins_balance: student.studentProfile?.coinsBalance ?? 0,
    created_at: student.createdAt.toISOString(),
  } satisfies ApiStudentSummary;
}

export function presentStudent(student: StudentRow): ApiStudent {
  return {
    ...presentStudentSummary(student),
    current_streak: student.studentProfile?.currentStreak ?? 0,
    best_streak: student.studentProfile?.bestStreak ?? 0,
  } satisfies ApiStudent;
}
