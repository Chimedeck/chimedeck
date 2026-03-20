// Shared types for the card feature.

export interface Card {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: number;
  state: 'ACTIVE' | 'ARCHIVED';
  due_date: string | null;
  due_complete: boolean;
  start_date: string | null;
  cover_attachment_id: string | null;
  cover_color: string | null;
  cover_size: 'SMALL' | 'FULL';
  cover_image_url: string | null;
  created_at: string;
}
