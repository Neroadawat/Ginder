/**
 * Auth hooks — React Query mutations for auth flows.
 */

import {useMutation} from '@tanstack/react-query';
import {jwtDecode} from 'jwt-decode';

import {authApi} from '@/services/api/authApi';
import {useAuthStore} from '@/stores/authStore';
import {
  LoginRequest,
  SignUpRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '@/types/api';

/**
 * Decode a JWT token to extract the user ID (sub claim).
 */
function decodeUserId(token: string): string {
  try {
    return jwtDecode<{sub?: string}>(token).sub ?? '';
  } catch {
    return '';
  }
}

export const useLogin = () => {
  const setTokens = useAuthStore(state => state.setTokens);

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: response => {
      const userId = decodeUserId(response.access_token);
      setTokens(response.access_token, response.refresh_token, userId);
    },
  });
};

export const useSignUp = () => {
  const setTokens = useAuthStore(state => state.setTokens);

  return useMutation({
    mutationFn: (data: SignUpRequest) => authApi.signUp(data),
    onSuccess: response => {
      const userId = decodeUserId(response.access_token);
      setTokens(response.access_token, response.refresh_token, userId);
    },
  });
};

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: (data: ForgotPasswordRequest) => authApi.forgotPassword(data),
  });
};

export const useResetPassword = () => {
  return useMutation({
    mutationFn: (data: ResetPasswordRequest) => authApi.resetPassword(data),
  });
};
