// RTK-Query-style API wrapper for the admin create-user endpoint.
// Uses the shared apiClient so Bearer tokens are attached automatically.
// The apiClient response interceptor unwraps Axios wrappers, so we cast
// to the actual runtime response type.
import { apiClient } from '~/common/api/client';
import type { AdminCreateUserRequest, AdminCreateUserResponse } from './types';

export const adminInviteApi = {
  createUser(body: AdminCreateUserRequest): Promise<AdminCreateUserResponse> {
    return apiClient.post('/admin/users', body) as unknown as Promise<AdminCreateUserResponse>;
  },
};
