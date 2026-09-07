/**
 * Auth API — signup, login, refresh, password reset.
 */

import apiClient from './client';
import {
  TokenResponse,
  SignUpRequest,
  LoginRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  MessageResponse,
} from '@/types/api';

export const authApi = {
  signUp: async (data: SignUpRequest): Promise<TokenResponse> => {
    const response = await apiClient.post('/auth/signup', data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    const response = await apiClient.post('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  forgotPassword: async (data: ForgotPasswordRequest): Promise<MessageResponse> => {
    const response = await apiClient.post('/auth/forgot-password', data);
    return response.data;
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<MessageResponse> => {
    const response = await apiClient.post('/auth/reset-password', data);
    return response.data;
  },
};
