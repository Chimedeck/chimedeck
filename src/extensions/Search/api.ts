// src/extensions/Search/api.ts
// Client-side API calls for the search extension.

export interface SearchResult {
  id: string;
  title: string;
  type: 'board' | 'card';
  workspaceId?: string;
  listId?: string;
  boardId?: string;
  archived?: boolean;
  rank?: number;
  /** Background image URL — only present for board results */
  background?: string | null;
}

export interface BoardSearchResult {
  type: 'card' | 'list';
  id: string;
  title: string;
  /** Present for card results; absent for list results */
  listId?: string;
}

export interface BoardSearchResponse {
  data: BoardSearchResult[];
}

export interface SearchResponse {
  data: SearchResult[];
  metadata: { cursor: string | null; hasMore: boolean };
}

export async function searchWorkspace({
  workspaceId,
  q,
  type,
  cursor,
  limit = 20,
  token,
}: {
  workspaceId: string;
  q: string;
  type?: 'board' | 'card';
  cursor?: string;
  limit?: number;
  token: string;
}): Promise<SearchResponse> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  if (type) params.set('type', type);
  if (cursor) params.set('cursor', cursor);

  const res = await fetch(`/api/v1/workspaces/${workspaceId}/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw err;
  }

  return res.json() as Promise<SearchResponse>;
}

export async function searchBoard({
  boardId,
  q,
  limit = 20,
  token,
}: {
  boardId: string;
  q: string;
  limit?: number;
  token: string;
}): Promise<BoardSearchResponse> {
  const params = new URLSearchParams({ q, limit: String(limit) });

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/boards/${boardId}/search?${params.toString()}`, { headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw err?.error ?? err;
  }

  return res.json() as Promise<BoardSearchResponse>;
}
