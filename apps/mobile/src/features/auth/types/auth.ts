import type { ApiUser as User } from '@nivela/api-contract';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterStudentPayload {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  join_code: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface MeResponse {
  user: User;
}
