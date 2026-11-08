export type Role = 'admin' | 'teacher' | 'student';

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
};
