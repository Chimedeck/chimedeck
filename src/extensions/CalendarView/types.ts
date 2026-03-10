// Types for the CalendarView extension (Sprint 53 — Calendar View).
import type { Card } from '../Card/api';
import type { List } from '../List/api';

export type CalendarMode = 'month' | 'week';

export interface CalendarViewProps {
  cards: Card[];
  lists: Record<string, List>;
  onCardClick: (cardId: string) => void;
}

export interface CalendarMonthGridProps {
  year: number;
  month: number; // 0-indexed (0 = January)
  cardsByDay: Map<string, Card[]>; // key: "YYYY-MM-DD"
  onPrev: () => void;
  onNext: () => void;
  onCardClick: (cardId: string) => void;
}

export interface CalendarWeekGridProps {
  /** The Sunday that starts the displayed week (Date object, local midnight). */
  weekStart: Date;
  cardsByDay: Map<string, Card[]>; // key: "YYYY-MM-DD"
  onPrev: () => void;
  onNext: () => void;
  onCardClick: (cardId: string) => void;
  onCardDrop?: (cardId: string, newDate: string) => void;
}

export interface CalendarDayCellProps {
  date: Date;
  cards: Card[];
  isCurrentMonth: boolean;
  onCardClick: (cardId: string) => void;
}

export interface CalendarCardChipProps {
  card: Card;
  onClick: (cardId: string) => void;
}

// Max chips shown before "+N more" overflow
export const MAX_CHIPS_PER_DAY = 3;
