// Types for the TimelineView extension (Sprint 54 — Timeline/Gantt View).
import type { Card } from '../Card/api';
import type { List } from '../List/api';

export type ZoomLevel = 'day' | 'week' | 'month';

export interface TimelineViewProps {
  cards: Card[];
  lists: Record<string, List>;
  onCardClick: (cardId: string) => void;
  addToast?: (message: string, variant?: 'error' | 'success' | 'conflict') => void;
}

export interface Swimlane {
  listId: string;
  listTitle: string;
  /** Cards with both start_date and due_date — rendered as bars (Sprint 54 Iteration 7). */
  scheduledCards: Card[];
  /** Cards missing start_date or due_date — rendered as chips below the swimlane. */
  unscheduledCards: Card[];
}

export interface TimelineHeaderProps {
  zoom: ZoomLevel;
  originDate: Date;
  totalDays: number;
  dayWidth: number;
  labelWidth: number;
  today: Date;
}

export interface TimelineRowProps {
  swimlane: Swimlane;
  zoom: ZoomLevel;
  originDate: Date;
  totalDays: number;
  dayWidth: number;
  labelWidth: number;
  today: Date;
  onCardClick: (cardId: string) => void;
}

export interface TimelineZoomControlProps {
  zoom: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
}
