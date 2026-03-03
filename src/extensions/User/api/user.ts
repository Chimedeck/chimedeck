// Typed API wrappers for user profile endpoints.
import { apiClient } from '~/common/api/client';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  created_at: string;
}

export const userApi = {
  getProfile() {
    return apiClient.get<{ data: UserProfile }>('/users/me');
  },
  updateProfile({ nickname, name }: { nickname?: string; name?: string }) {
    return apiClient.patch<{ data: UserProfile }>('/users/me', { nickname, name });
  },
  uploadAvatar({ file }: { file: File }) {
    const form = new FormData();
    form.append('avatar', file);
    return apiClient.post<{ data: { avatar_url: string } }>('/users/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  removeAvatar() {
    return apiClient.delete('/users/me/avatar');
  },
};
