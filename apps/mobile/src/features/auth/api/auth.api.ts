import type { AxiosResponse } from 'axios';
import api from 'src/lib/axios';
import type {
  AuthResponse,
  LoginPayload,
  MeResponse,
  RegisterStudentPayload,
} from 'src/features/auth/types/auth';

export const login = (data: LoginPayload): Promise<AxiosResponse<AuthResponse>> =>
  api.post<AuthResponse>('/auth/login', { ...data, channel: 'mobile' });

export const registerStudent = (data: RegisterStudentPayload): Promise<AxiosResponse<AuthResponse>> =>
  api.post<AuthResponse>('/auth/register-student', data);

export const getMe = (): Promise<AxiosResponse<MeResponse>> => api.get<MeResponse>('/auth/me');

export const logout = (): Promise<AxiosResponse<void>> => api.post<void>('/auth/logout');
