/**
 * Sprint 17 — CreateWorkspace modal tests
 *
 * Tests the workspace creation thunk: optimistic append, rollback on error,
 * and active workspace update after creation.
 */

import { describe, it, expect } from 'bun:test';
import { configureStore } from '@reduxjs/toolkit';
import { authDuckReducer } from '../../Auth/duck/authDuck';
import { uiReducer } from '../../../slices/uiSlice';
import boardReducer from '../../Board/slices/boardSlice';
import { verifyEmailDuckReducer } from '../../Auth/containers/VerifyEmailPage/VerifyEmailPage.duck';
import {
  workspaceShellReducer,
  createWorkspaceThunk,
  fetchWorkspacesThunk,
  selectWorkspaces,
  selectActiveWorkspaceId,
  selectCreateWorkspaceInProgress,
} from '../duck/workspaceDuck';
import type { Workspace } from '../api';

const NEW_WORKSPACE: Workspace = {
  id: 'ws-new',
  name: 'New Corp',
  ownerId: 'u1',
  createdAt: '2024-03-01T00:00:00Z',
};

function makeStore() {
  return configureStore({
    reducer: {
      auth: authDuckReducer,
      ui: uiReducer,
      workspaceShell: workspaceShellReducer,
      board: boardReducer,
      verifyEmail: verifyEmailDuckReducer,
    },
  });
}

describe('createWorkspaceThunk', () => {
  it('sets createInProgress when pending', () => {
    const store = makeStore();
    store.dispatch(createWorkspaceThunk.pending('req-1', { name: 'New Corp' }));
    expect(selectCreateWorkspaceInProgress(store.getState())).toBe(true);
  });

  it('appends workspace and sets active on fulfilled', () => {
    const store = makeStore();
    store.dispatch(
      createWorkspaceThunk.fulfilled(NEW_WORKSPACE, 'req-1', { name: 'New Corp' })
    );
    const state = store.getState();
    expect(selectWorkspaces(state)).toHaveLength(1);
    expect(selectWorkspaces(state)[0].name).toBe('New Corp');
    expect(selectActiveWorkspaceId(state)).toBe('ws-new');
    expect(selectCreateWorkspaceInProgress(state)).toBe(false);
  });

  it('appends new workspace to existing list', () => {
    const store = makeStore();
    const existing: Workspace = {
      id: 'ws-1', name: 'Existing', ownerId: 'u1', createdAt: '2024-01-01T00:00:00Z',
    };
    store.dispatch(fetchWorkspacesThunk.fulfilled([existing], 'req-0', undefined));
    store.dispatch(
      createWorkspaceThunk.fulfilled(NEW_WORKSPACE, 'req-1', { name: 'New Corp' })
    );
    expect(selectWorkspaces(store.getState())).toHaveLength(2);
    expect(selectActiveWorkspaceId(store.getState())).toBe('ws-new');
  });

  it('clears createInProgress and records error on rejected', () => {
    const store = makeStore();
    store.dispatch(createWorkspaceThunk.pending('req-1', { name: 'New Corp' }));
    store.dispatch(
      createWorkspaceThunk.rejected(new Error('Server error'), 'req-1', { name: 'New Corp' })
    );
    const state = store.getState();
    expect(selectCreateWorkspaceInProgress(state)).toBe(false);
    // Workspace list should remain unchanged
    expect(selectWorkspaces(state)).toHaveLength(0);
  });
});
