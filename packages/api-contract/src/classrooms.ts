/** Turma na listagem e no cadastro. */
export interface ApiClassroomSummary {
  id: number;
  name: string;
  school_year: string | null;
  join_code: string;
  active: boolean;
  students_count: number;
  teacher: { id: number; name: string };
  created_at: string;
}

/** Aluno matriculado, como aparece dentro de uma turma. */
export interface ApiClassroomStudent {
  id: number;
  name: string;
  email: string;
  active: boolean;
  joined_at: string;
}

/** Ficha da turma, com os alunos matriculados. */
export interface ApiClassroom extends ApiClassroomSummary {
  students: ApiClassroomStudent[];
}

/** Turma do ponto de vista do aluno (`/me/classrooms`). */
export interface ApiMyClassroom {
  id: number;
  name: string;
  school_year: string | null;
  teacher: { name: string };
  joined_at: string;
}

/** Resposta de `POST /classrooms/:id/join-code` (código novo). */
export interface ApiJoinCode {
  join_code: string;
}
