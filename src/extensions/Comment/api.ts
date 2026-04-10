// Comment API helpers — reaction endpoints.
import type { ApiClient } from '~/extensions/Card/api/cardDetail';

export async function addReaction({
  api,
  commentId,
  emoji,
}: {
  api: ApiClient;
  commentId: string;
  emoji: string;
}): Promise<void> {
  await api.post(`/comments/${commentId}/reactions`, { emoji });
}

export async function removeReaction({
  api,
  commentId,
  emoji,
}: {
  api: ApiClient;
  commentId: string;
  emoji: string;
}): Promise<void> {
  await api.delete(`/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`);
}
