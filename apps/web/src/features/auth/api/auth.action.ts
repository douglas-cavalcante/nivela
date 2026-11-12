import * as authApi from 'src/features/auth/api/auth.api';
import type { ChangePasswordPayload, LoginPayload, LoginResponse, MeResponse } from 'src/features/auth/types/auth';

export const loginAction = async (data: LoginPayload): Promise<LoginResponse> => (await authApi.login(data)).data;

export const getMeAction = async (): Promise<MeResponse> => (await authApi.getMe()).data;

export const logoutAction = async (): Promise<void> => {
  await authApi.logout();
};

export const changePasswordAction = async (data: ChangePasswordPayload): Promise<void> => {
  await authApi.changePassword(data);
};
