// Types for the TimelineView extension (Sprint 54 — Timeline/Gantt View).
import type { MouseEvent } from 'react';
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
  /** Cards with a due_date — rendered as bars. start_date defaults to today if absent. */
  scheduledCards: Card[];
  /** Cards missing due_date — rendered as chips below the swimlane. */
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
  addToast?: (message: string, variant?: 'error' | 'success' | 'conflict') => void;
}

export interface TimelineZoomControlProps {
  zoom: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
}

// ── Bar + drag types (Sprint 54 Iteration 7) ────────────────────────────────

/** Optimistic date overrides applied during an active drag. */
export interface TimelineDragOverride {
  start_date: string;
  due_date: string;
}

export interface TimelineBarProps {
  card: Card;
  originDate: Date;
  dayWidth: number;
  /** Which vertical sub-row inside the swimlane to place the bar (0 = top). */
  rowIndex: number;
  /** Optional optimistic override applied while the user is dragging. */
  dragOverride?: TimelineDragOverride;
  onCardClick: (cardId: string) => void;
  onMoveStart: (cardId: string, e: MouseEvent) => void;
  onResizeLeftStart: (cardId: string, e: MouseEvent) => void;
  onResizeRightStart: (cardId: string, e: MouseEvent) => void;
}

export interface UseTimelineDragOptions {
  cards: Card[];
  dayWidth: number;
  addToast?: (message: string, variant?: 'error' | 'success' | 'conflict') => void;
}

export interface UseTimelineDragResult {
  /** Per-card optimistic overrides while a drag is in progress. */
  dragOverrides: Record<string, TimelineDragOverride>;
  handleMoveStart: (cardId: string, e: MouseEvent) => void;
  handleResizeLeftStart: (cardId: string, e: MouseEvent) => void;
  handleResizeRightStart: (cardId: string, e: MouseEvent) => void;
}
