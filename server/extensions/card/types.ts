// Shared types for the card feature.

export interface Card {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: number;
  state: 'ACTIVE' | 'ARCHIVED';
  due_date: string | null;
  start_date: string | null;
  created_at: string;
}
