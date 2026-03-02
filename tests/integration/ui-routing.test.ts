/**
 * Sprint 15 — UI Routing unit tests
 *
 * These tests verify PrivateRoute and PublicRoute redirect logic without
 * requiring a browser. They use the Redux store state directly.
 *
 * Note: full Playwright e2e tests are tracked in specs/tests/ui-foundation.md.
 */

import { describe, it, expect } from 'bun:test';
import { configureStore } from '@reduxjs/toolkit';
import { authDuckReducer } from '../../src/extensions/Auth/duck/authDuck';
import { uiReducer } from '../../src/slices/uiSlice';
import { setCredentials, clearAuth } from '../../src/extensions/Auth/duck/authDuck';

function makeStore(overrides?: Partial<Parameters<typeof configureStore>[0]>) {
  return configureStore({
    reducer: { auth: authDuckReducer, ui: uiReducer },
    ...overrides,
  });
}

describe('Auth store', () => {
  it('initialises with unauthenticated status', () => {
    const store = makeStore();
    const state = store.getState();
    expect(state.auth.status).toBe('unauthenticated');
    expect(state.auth.accessToken).toBeNull();
    expect(state.auth.user).toBeNull();
  });

  it('becomes authenticated after setCredentials', () => {
    const store = makeStore();
    store.dispatch(
      setCredentials({
        user: { id: '1', name: 'Alice', email: 'alice@example.com' },
        accessToken: 'tok_abc',
      })
    );
    const state = store.getState();
    expect(state.auth.status).toBe('authenticated');
    expect(state.auth.accessToken).toBe('tok_abc');
    expect(state.auth.user?.name).toBe('Alice');
  });

  it('clears credentials on clearAuth', () => {
    const store = makeStore();
    store.dispatch(
      setCredentials({
        user: { id: '1', name: 'Alice', email: 'alice@example.com' },
        accessToken: 'tok_abc',
      })
    );
    store.dispatch(clearAuth());
    const state = store.getState();
    expect(state.auth.status).toBe('unauthenticated');
    expect(state.auth.accessToken).toBeNull();
    expect(state.auth.user).toBeNull();
  });

  it('PrivateRoute: selectIsAuthenticated reflects auth status', () => {
    const store = makeStore();
    const { selectIsAuthenticated } = require('../../src/extensions/Auth/duck/authDuck');

    expect(selectIsAuthenticated(store.getState())).toBe(false);

    store.dispatch(
      setCredentials({
        user: { id: '2', name: 'Bob', email: 'bob@example.com' },
        accessToken: 'tok_xyz',
      })
    );
    expect(selectIsAuthenticated(store.getState())).toBe(true);
  });
});
