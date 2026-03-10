// Types for the board view preference feature.
export type ViewType = 'KANBAN' | 'TABLE' | 'CALENDAR' | 'TIMELINE';

export const VALID_VIEW_TYPES: ViewType[] = ['KANBAN', 'TABLE', 'CALENDAR', 'TIMELINE'];

export interface ViewPreference {
  id: string;
  user_id: string;
  board_id: string;
  view_type: ViewType;
  updated_at: string;
}
