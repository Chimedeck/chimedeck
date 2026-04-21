// TypeScript types for board-level views: activity, comments, archived cards.

export interface BoardActivityEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  board_id: string | null;
  action: string;
  actor_id: string;
  payload: Record<string, unknown>;
  created_at: string;
  actor_name?: string | null;
}

export interface BoardComment {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  version: number;
  deleted: boolean;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
  author_email?: string | null;
  card_title?: string | null;
}

export interface ArchivedCard {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: number;
  archived: boolean;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  list_title: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  metadata: {
    cursor: string | null;
    hasMore: boolean;
  };
}

export type BoardTimelineItem =
  | { kind: 'activity'; data: BoardActivityEntry }
  | { kind: 'comment'; data: BoardComment };
