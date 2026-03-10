import type { ViewType } from './types';

export const VIEW_TYPES: ViewType[] = ['KANBAN', 'TABLE', 'CALENDAR', 'TIMELINE'];

// Default view when no preference is saved yet
export const DEFAULT_VIEW: ViewType = 'KANBAN';
