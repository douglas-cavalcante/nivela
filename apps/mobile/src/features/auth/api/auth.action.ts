import * as authApi from 'src/features/auth/api/auth.api';
import type {
  AuthResponse,
  LoginPayload,
  MeResponse,
  RegisterStudentPayload,
} from 'src/features/auth/types/auth';

export const loginAction = async (data: LoginPayload): Promise<AuthResponse> => (await authApi.login(data)).data;

export const registerStudentAction = async (data: RegisterStudentPayload): Promise<AuthResponse> =>
  (await authApi.registerStudent(data)).data;

export const getMeAction = async (): Promise<MeResponse> => (await authApi.getMe()).data;

export const logoutAction = async (): Promise<void> => {
  await authApi.logout();
};
