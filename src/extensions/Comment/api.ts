// Comment API helpers — reactions and threaded replies.
import type { ApiClient } from '~/extensions/Card/api/cardDetail';
import type { CommentData } from '~/extensions/Card/api/cardDetail';

export async function getReplies({
  api,
  commentId,
}: {
  api: ApiClient;
  commentId: string;
}): Promise<CommentData[]> {
  const res = await api.get<{ data: CommentData[] }>(`/comments/${commentId}/replies`);
  return (res as unknown as { data: CommentData[] }).data;
}

export async function postReply({
  api,
  cardId,
  parentId,
  content,
}: {
  api: ApiClient;
  cardId: string;
  parentId: string;
  content: string;
}): Promise<CommentData> {
  const res = await api.post<{ data: CommentData }>(`/cards/${cardId}/comments`, {
    content,
    parent_id: parentId,
  });
  return (res as unknown as { data: CommentData }).data;
}

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
