/** Professor como a API o devolve (nunca inclui a senha). */
export interface ApiTeacher {
  id: number;
  name: string;
  email: string;
  active: boolean;
  classrooms_count: number;
  created_at: string;
}
