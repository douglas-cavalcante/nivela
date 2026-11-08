/** Aluno na listagem (nunca inclui a senha). */
export interface ApiStudentSummary {
  id: number;
  name: string;
  email: string;
  active: boolean;
  classrooms: Array<{ id: number; name: string }>;
  coins_balance: number;
  created_at: string;
}

/** Ficha do aluno. */
export interface ApiStudent extends ApiStudentSummary {
  current_streak: number;
  best_streak: number;
}
