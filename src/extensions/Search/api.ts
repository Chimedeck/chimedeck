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
