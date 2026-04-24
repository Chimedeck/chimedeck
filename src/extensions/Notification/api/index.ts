// Client API module for notification endpoints.
import { apiClient } from '~/common/api/client';

export interface NotificationActor {
  id: string;
  nickname: string | null;
  name: string | null;
  avatar_url: string | null;
}

export interface NotificationCommentReaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  reactors: Array<{ userId: string; name: string | null }>;
}

export type NotificationType =
  | 'mention'
  | 'card_created'
  | 'card_moved'
  | 'card_commented'
  | 'comment_reaction'
  | 'card_member_assigned'
  | 'card_member_unassigned'
  | 'checklist_item_assigned'
  | 'checklist_item_unassigned'
  | 'checklist_item_due_date_updated'
  | 'card_updated'
  | 'card_deleted'
  | 'card_archived';

export interface Notification {
  id: string;
  type: NotificationType | (string & {});
  source_type: 'card_description' | 'comment' | 'board_activity';
  source_id: string;
  card_id: string | null;
  emoji?: string | null;
  card_title: string | null;
  board_id: string | null;
  board_title: string | null;
  /** Destination list name — populated for card_moved notifications */
  list_title: string | null;
  /** Raw comment markdown content when source_id references a comment. */
  comment_content?: string | null;
  /** Aggregated comment reactions for comment-backed notifications. */
  comment_reactions?: NotificationCommentReaction[];
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

  deleteAll(): Promise<void> {
    return apiClient.delete('/notifications');
  },

  addCommentReaction({ commentId, emoji }: { commentId: string; emoji: string }): Promise<void> {
    return apiClient.post(`/comments/${commentId}/reactions`, { emoji });
  },

  removeCommentReaction({ commentId, emoji }: { commentId: string; emoji: string }): Promise<void> {
    return apiClient.delete(`/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`);
  },
};
