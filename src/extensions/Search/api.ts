// src/extensions/Search/api.ts
// Client-side API calls for the search extension.

export interface SearchResult {
  id: string;
  title: string;
  type: 'board' | 'card';
  short_id?: string;
  board_short_id?: string;
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

  const json = await res.json() as {
    data: Array<Record<string, unknown>>;
    metadata: { cursor: string | null; hasMore: boolean };
  };

  // [why] The server returns snake_case fields (board_id, workspace_id, list_id) because
  // they come directly from Knex/PostgreSQL column names. The client SearchResult type
  // and all navigation handlers expect camelCase, so we remap here at the API boundary.
  const data: SearchResult[] = json.data.map((item) => {
    const boardId = (item.boardId ?? item.board_id) as string | undefined;
    const workspaceId = (item.workspaceId ?? item.workspace_id) as string | undefined;
    const listId = (item.listId ?? item.list_id) as string | undefined;
    const archived = item.archived as boolean | undefined;
    const background = (item.background ?? null) as string | null;

    return {
      id: item.id as string,
      title: item.title as string,
      type: item.type as 'board' | 'card',
      ...(typeof item.short_id === 'string' ? { short_id: item.short_id } : {}),
      ...(typeof item.board_short_id === 'string' ? { board_short_id: item.board_short_id } : {}),
      ...(typeof boardId === 'string' ? { boardId } : {}),
      ...(typeof workspaceId === 'string' ? { workspaceId } : {}),
      ...(typeof listId === 'string' ? { listId } : {}),
      ...(typeof archived === 'boolean' ? { archived } : {}),
      ...(background === null ? {} : { background }),
    };
  });

  return { data, metadata: json.metadata };
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
