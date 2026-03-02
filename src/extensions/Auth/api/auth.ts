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

export const authApi = {
  login({ email, password }: LoginPayload) {
    return apiClient.post<{ data: AuthResponse }>('/auth/token', { email, password });
  },
  signup({ name, email, password }: SignupPayload) {
    return apiClient.post<{ data: AuthResponse }>('/auth/register', { name, email, password });
  },
  refreshToken() {
    return apiClient.post<{ data: AuthResponse }>('/auth/refresh');
  },
  logout() {
    return apiClient.delete('/auth/session');
  },
};
