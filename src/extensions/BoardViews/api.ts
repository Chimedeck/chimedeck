// Client API functions for board-level views and star actions.
// Uses the shared apiClient so auth headers are attached automatically.
import { apiClient } from '~/common/api/client';
import type {
  BoardActivityEntry,
  BoardComment,
  ArchivedCard,
  PaginatedResponse,
} from './types';

export async function getBoardActivity({
  boardId,
  cursor,
  limit = 50,
}: {
  boardId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<PaginatedResponse<BoardActivityEntry>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return apiClient.get(`/boards/${boardId}/activity?${params}`);
}

export async function getBoardComments({
  boardId,
  cursor,
  limit = 50,
}: {
  boardId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<PaginatedResponse<BoardComment>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return apiClient.get(`/boards/${boardId}/comments?${params}`);
}

export async function getArchivedCards({
  boardId,
}: {
  boardId: string;
}): Promise<{ data: ArchivedCard[] }> {
  return apiClient.get(`/boards/${boardId}/archived-cards`);
}

export async function starBoard({ boardId }: { boardId: string }): Promise<void> {
  await apiClient.post(`/boards/${boardId}/star`, {});
}

export async function unstarBoard({ boardId }: { boardId: string }): Promise<void> {
  await apiClient.delete(`/boards/${boardId}/star`);
}

export async function getStarredBoards(): Promise<{ data: Array<Record<string, unknown>> }> {
  return apiClient.get('/me/starred-boards');
}
