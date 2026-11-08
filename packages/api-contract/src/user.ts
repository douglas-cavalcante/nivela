export type Role = 'admin' | 'teacher' | 'student';

/** Usuário como a API o devolve (nunca inclui a senha). */
export interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}
