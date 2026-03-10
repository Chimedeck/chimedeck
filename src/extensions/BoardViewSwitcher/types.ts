// Types for the BoardViewSwitcher extension (Sprint 52 — view persistence).

export type ViewType = 'KANBAN' | 'TABLE' | 'CALENDAR' | 'TIMELINE';

export interface ViewPreference {
  viewType: ViewType;
}

export interface ViewPreferenceState {
  activeView: ViewType;
  status: 'idle' | 'loading' | 'error';
}
