// Unit tests for viewPreference.slice (Sprint 52).
// Tests the Redux slice in isolation — no real API calls.
import { describe, it, expect } from 'bun:test';
import { configureStore } from '@reduxjs/toolkit';
import type { RootState } from '~/store';
import viewPreferenceReducer, {
  setActiveView,
  fetchViewPreference,
  saveViewPreference,
  selectActiveView,
  selectViewPreferenceStatus,
} from '../viewPreference.slice';
import type { ViewPreferenceState } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

type ViewPreferenceTestState = Pick<RootState, 'viewPreference'>;

function asRootState(state: ViewPreferenceTestState): RootState {
  return state as RootState;
}

function makeStore(preloaded?: Partial<ViewPreferenceState>) {
  return configureStore({
    reducer: { viewPreference: viewPreferenceReducer },
    preloadedState: preloaded ? { viewPreference: { activeView: 'KANBAN', status: 'idle', ...preloaded } } : undefined,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('viewPreference slice — setActiveView', () => {
  it('defaults to KANBAN', () => {
    const store = makeStore();
    expect(selectActiveView(asRootState(store.getState()))).toBe('KANBAN');
  });

  it('updates activeView optimistically', () => {
    const store = makeStore();
    store.dispatch(setActiveView('TABLE'));
    expect(selectActiveView(asRootState(store.getState()))).toBe('TABLE');
  });

  it('cycles through all view types', () => {
    const store = makeStore();
    for (const view of ['KANBAN', 'TABLE', 'CALENDAR', 'TIMELINE'] as const) {
      store.dispatch(setActiveView(view));
      expect(selectActiveView(asRootState(store.getState()))).toBe(view);
    }
  });
});

describe('viewPreference slice — fetchViewPreference thunk', () => {
  it('sets status to loading on pending', () => {
    const store = makeStore();
    store.dispatch({ type: fetchViewPreference.pending.type, meta: { requestId: 'r1', arg: { boardId: 'b1' } } });
    expect(selectViewPreferenceStatus(asRootState(store.getState()))).toBe('loading');
  });

  it('sets activeView on fulfilled', () => {
    const store = makeStore();
    store.dispatch({ type: fetchViewPreference.fulfilled.type, payload: 'CALENDAR', meta: { requestId: 'r1', arg: { boardId: 'b1' } } });
    expect(selectActiveView(asRootState(store.getState()))).toBe('CALENDAR');
    expect(selectViewPreferenceStatus(asRootState(store.getState()))).toBe('idle');
  });

  it('falls back to KANBAN if payload is undefined', () => {
    const store = makeStore({ activeView: 'TABLE' });
    store.dispatch({ type: fetchViewPreference.fulfilled.type, payload: undefined, meta: { requestId: 'r1', arg: { boardId: 'b1' } } });
    expect(selectActiveView(asRootState(store.getState()))).toBe('KANBAN');
  });

  it('resets status to idle on rejected', () => {
    const store = makeStore();
    store.dispatch({ type: fetchViewPreference.rejected.type, meta: { requestId: 'r1', arg: { boardId: 'b1' } } });
    expect(selectViewPreferenceStatus(asRootState(store.getState()))).toBe('idle');
  });
});

describe('viewPreference slice — saveViewPreference thunk', () => {
  it('sets status to loading on pending', () => {
    const store = makeStore();
    store.dispatch({ type: saveViewPreference.pending.type, meta: { requestId: 'r2', arg: { boardId: 'b1', viewType: 'TABLE' } } });
    expect(selectViewPreferenceStatus(asRootState(store.getState()))).toBe('loading');
  });

  it('confirms activeView on fulfilled', () => {
    const store = makeStore({ activeView: 'TABLE' });
    store.dispatch({ type: saveViewPreference.fulfilled.type, payload: 'TABLE', meta: { requestId: 'r2', arg: { boardId: 'b1', viewType: 'TABLE' } } });
    expect(selectActiveView(asRootState(store.getState()))).toBe('TABLE');
    expect(selectViewPreferenceStatus(asRootState(store.getState()))).toBe('idle');
  });

  it('keeps current view if payload is undefined on fulfilled', () => {
    const store = makeStore({ activeView: 'CALENDAR' });
    store.dispatch({ type: saveViewPreference.fulfilled.type, payload: undefined, meta: { requestId: 'r2', arg: { boardId: 'b1', viewType: 'CALENDAR' } } });
    expect(selectActiveView(asRootState(store.getState()))).toBe('CALENDAR');
  });
});
