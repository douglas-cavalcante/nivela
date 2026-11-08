import type {
  ApiClassroom,
  ApiClassroomSummary,
  ApiMyClassroom,
} from '@nivela/api-contract';

interface ClassroomRow {
  id: number;
  name: string;
  schoolYear: string | null;
  joinCode: string;
  active: boolean;
  createdAt: Date;
  teacher: { id: number; name: string };
  _count: { students: number };
}

export function presentClassroomSummary(
  classroom: ClassroomRow,
): ApiClassroomSummary {
  return {
    id: classroom.id,
    name: classroom.name,
    school_year: classroom.schoolYear,
    join_code: classroom.joinCode,
    active: classroom.active,
    students_count: classroom._count.students,
    teacher: { id: classroom.teacher.id, name: classroom.teacher.name },
    created_at: classroom.createdAt.toISOString(),
  } satisfies ApiClassroomSummary;
}

export function presentClassroom(
  classroom: ClassroomRow & {
    students: Array<{
      joinedAt: Date;
      student: { id: number; name: string; email: string; active: boolean };
    }>;
  },
): ApiClassroom {
  return {
    ...presentClassroomSummary(classroom),
    students: classroom.students.map(({ joinedAt, student }) => ({
      id: student.id,
      name: student.name,
      email: student.email,
      active: student.active,
      joined_at: joinedAt.toISOString(),
    })),
  } satisfies ApiClassroom;
}

export function presentMyClassroom(
  classroom: {
    id: number;
    name: string;
    schoolYear: string | null;
    teacher: { name: string };
  },
  joinedAt: Date,
): ApiMyClassroom {
  return {
    id: classroom.id,
    name: classroom.name,
    school_year: classroom.schoolYear,
    teacher: { name: classroom.teacher.name },
    joined_at: joinedAt.toISOString(),
  } satisfies ApiMyClassroom;
}
