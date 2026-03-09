// Typed API wrappers for auth endpoints.
// All calls go through the shared apiClient which attaches Bearer tokens.
import { apiClient } from '~/common/api/client';
import type { AuthUser } from '../duck/authDuck';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface SignupResponse {
  requiresVerification?: boolean;
  user?: AuthUser;
  accessToken?: string;
}

export const authApi = {
  login({ email, password }: LoginPayload) {
    return apiClient.post<{ data: AuthResponse }>('/auth/token', { email, password });
  },
  signup({ name, email, password }: SignupPayload) {
    return apiClient.post<{ data: SignupResponse }>('/auth/register', { name, email, password });
  },
  refreshToken() {
    return apiClient.post<{ data: AuthResponse }>('/auth/refresh');
  },
  logout() {
    return apiClient.delete('/auth/session');
  },
  verifyEmail({ token }: { token: string }) {
    return apiClient.get<{ data: AuthResponse }>(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  },
  resendVerification() {
    return apiClient.post<{ data: { sent: boolean } }>('/auth/resend-verification');
  },
  changeEmail({ email, currentPassword }: { email: string; currentPassword: string }) {
    return apiClient.post<{ data: { requiresConfirmation?: boolean; pendingEmail?: string; email?: string } }>(
      '/auth/change-email',
      { email, currentPassword },
    );
  },
  confirmEmailChange({ token }: { token: string }) {
    return apiClient.get<{ data: { confirmed: boolean } }>(
      `/auth/confirm-email-change?token=${encodeURIComponent(token)}`,
    );
  },
  forgotPassword({ email }: { email: string }) {
    return apiClient.post<{ data: { sent: boolean } }>('/auth/forgot-password', { email });
  },
  resetPassword({ token, password }: { token: string; password: string }) {
    return apiClient.post<{ data: { reset: boolean } }>('/auth/reset-password', { token, password });
  },
};
