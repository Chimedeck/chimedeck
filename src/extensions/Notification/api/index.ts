// Client API module for notification endpoints.
import { apiClient } from '~/common/api/client';

export interface NotificationActor {
  id: string;
  nickname: string | null;
  name: string | null;
  avatar_url: string | null;
}

export interface Notification {
  id: string;
  type: string;
  source_type: 'card_description' | 'comment';
  source_id: string;
  card_id: string | null;
  card_title: string | null;
  board_id: string | null;
  board_title: string | null;
  actor: NotificationActor;
  read: boolean;
  created_at: string;
}

export interface ListNotificationsResponse {
  data: Notification[];
  metadata: { cursor: string | null; hasMore: boolean };
}

export const notificationApi = {
  list({ unread, limit, cursor }: { unread?: boolean; limit?: number; cursor?: string | null } = {}): Promise<ListNotificationsResponse> {
    const params: Record<string, string> = {};
    if (unread) params.unread = 'true';
    if (limit) params.limit = String(limit);
    if (cursor) params.cursor = cursor;
    return apiClient.get('/notifications', { params });
  },

  markRead({ id }: { id: string }): Promise<{ data: { id: string; read: boolean } }> {
    return apiClient.patch(`/notifications/${id}/read`);
  },

  markAllRead(): Promise<{ data: { updated: number } }> {
    return apiClient.patch('/notifications/read-all');
  },

  deleteOne({ id }: { id: string }): Promise<void> {
    return apiClient.delete(`/notifications/${id}`);
  },
};
