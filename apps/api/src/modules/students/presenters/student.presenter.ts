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
    lastStudyDate: Date | null;
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

/** `streak` é a sequência efetiva (Ruling 10), calculada por quem chama. */
export function presentStudent(
  student: StudentRow,
  streak: { current: number; best: number },
): ApiStudent {
  return {
    ...presentStudentSummary(student),
    current_streak: streak.current,
    best_streak: streak.best,
  } satisfies ApiStudent;
}
