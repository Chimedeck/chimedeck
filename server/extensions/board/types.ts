// Shared types for the board feature.

export type MonetizationType = 'pre-paid' | 'pay-to-paid';
export type BoardVisibility = 'PUBLIC' | 'PRIVATE' | 'WORKSPACE';

export interface Board {
  id: string;
  workspace_id: string;
  title: string;
  state: 'ACTIVE' | 'ARCHIVED';
  monetization_type: MonetizationType | null;
  visibility: BoardVisibility;
  description: string | null;
  background: string | null;
  created_at: string;
}

export interface BoardStar {
  user_id: string;
  board_id: string;
  created_at: string;
}

export interface BoardFollower {
  user_id: string;
  board_id: string;
  created_at: string;
}

export interface BoardWithIsStarred extends Board {
  isStarred: boolean;
}
