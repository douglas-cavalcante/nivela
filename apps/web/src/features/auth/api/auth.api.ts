import type { AxiosResponse } from 'axios';
import api from 'src/lib/axios';
import type { ChangePasswordPayload, LoginPayload, LoginResponse, MeResponse } from 'src/features/auth/types/auth';

export const login = (data: LoginPayload): Promise<AxiosResponse<LoginResponse>> =>
  api.post<LoginResponse>('/auth/login', { ...data, channel: 'web' });

export const getMe = (): Promise<AxiosResponse<MeResponse>> => api.get<MeResponse>('/auth/me');

export const logout = (): Promise<AxiosResponse<void>> => api.post<void>('/auth/logout');

export const changePassword = (data: ChangePasswordPayload): Promise<AxiosResponse<void>> =>
  api.put<void>('/auth/password', data);
