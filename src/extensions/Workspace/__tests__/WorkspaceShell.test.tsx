/**
 * Sprint 17 — Workspace Shell tests
 *
 * Tests workspace duck (workspaceShell slice): loading, active workspace
 * selection, and workspace switching.
 */

import { describe, it, expect } from 'bun:test';
import { configureStore } from '@reduxjs/toolkit';
import { authDuckReducer } from '../../Auth/duck/authDuck';
import { uiReducer } from '../../../slices/uiSlice';
import {
  workspaceShellReducer,
  fetchWorkspacesThunk,
  setActiveWorkspace,
  selectWorkspaces,
  selectActiveWorkspaceId,
  selectActiveWorkspace,
  selectWorkspacesStatus,
} from '../duck/workspaceDuck';
import type { Workspace } from '../api';

const MOCK_WORKSPACES: Workspace[] = [
  { id: 'ws-1', name: 'Acme Corp', ownerId: 'u1', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'ws-2', name: 'Beta Inc',  ownerId: 'u1', createdAt: '2024-02-01T00:00:00Z' },
];

function makeStore() {
  return configureStore({
    reducer: {
      auth: authDuckReducer,
      ui: uiReducer,
      workspaceShell: workspaceShellReducer,
    },
  });
}

describe('workspaceShell slice', () => {
  it('initialises in idle status with empty workspaces', () => {
    const store = makeStore();
    const state = store.getState();
    expect(selectWorkspacesStatus(state)).toBe('idle');
    expect(selectWorkspaces(state)).toEqual([]);
    expect(selectActiveWorkspaceId(state)).toBeNull();
  });

  it('setActiveWorkspace updates activeWorkspaceId', () => {
    const store = makeStore();
    store.dispatch(setActiveWorkspace('ws-1'));
    expect(selectActiveWorkspaceId(store.getState())).toBe('ws-1');
  });

  it('setActiveWorkspace changes active workspace', () => {
    const store = makeStore();
    store.dispatch(setActiveWorkspace('ws-1'));
    store.dispatch(setActiveWorkspace('ws-2'));
    expect(selectActiveWorkspaceId(store.getState())).toBe('ws-2');
  });

  it('fetchWorkspacesThunk.pending sets status to loading', () => {
    const store = makeStore();
    // Manually dispatch the pending action
    store.dispatch(fetchWorkspacesThunk.pending('req-1', undefined));
    expect(selectWorkspacesStatus(store.getState())).toBe('loading');
  });

  it('fetchWorkspacesThunk.fulfilled populates workspaces and auto-selects first', () => {
    const store = makeStore();
    store.dispatch(
      fetchWorkspacesThunk.fulfilled(MOCK_WORKSPACES, 'req-1', undefined)
    );
    const state = store.getState();
    expect(selectWorkspaces(state)).toHaveLength(2);
    expect(selectWorkspacesStatus(state)).toBe('idle');
    // Auto-selects the first workspace
    expect(selectActiveWorkspaceId(state)).toBe('ws-1');
  });

  it('fetchWorkspacesThunk.fulfilled does not override existing active workspace', () => {
    const store = makeStore();
    store.dispatch(setActiveWorkspace('ws-2'));
    store.dispatch(
      fetchWorkspacesThunk.fulfilled(MOCK_WORKSPACES, 'req-1', undefined)
    );
    // Should keep ws-2 as active since it was already set
    expect(selectActiveWorkspaceId(store.getState())).toBe('ws-2');
  });

  it('selectActiveWorkspace returns the active workspace object', () => {
    const store = makeStore();
    store.dispatch(
      fetchWorkspacesThunk.fulfilled(MOCK_WORKSPACES, 'req-1', undefined)
    );
    store.dispatch(setActiveWorkspace('ws-2'));
    const active = selectActiveWorkspace(store.getState());
    expect(active?.name).toBe('Beta Inc');
  });

  it('fetchWorkspacesThunk.rejected sets status to error', () => {
    const store = makeStore();
    store.dispatch(
      fetchWorkspacesThunk.rejected(new Error('Network error'), 'req-1', undefined)
    );
    expect(selectWorkspacesStatus(store.getState())).toBe('error');
  });
});
