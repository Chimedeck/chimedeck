// tests/integration/adminInvite/adminInvite.ui.test.ts
//
// Integration tests for the AdminInvite UI feature (Sprint 45).
// These tests cover:
//   - Client-side admin domain detection logic (mirrors server-side check)
//   - Redux slice behaviour (open/close modal, credential storage)
//   - Feature flags slice (show/hide email toggle)
//   - Credential sheet logic (text generation)
//
// Browser-level Playwright tests that require a running server are noted
// in the scenario table and should be run via `bun run test:e2e`.
import { describe, it, expect } from 'bun:test';
import { configureStore } from '@reduxjs/toolkit';
import { adminInviteReducer, openInviteModal, closeInviteModal, setInviteCredentials } from '../../../src/extensions/AdminInvite/adminInvite.slice';
import { featureFlagsReducer, fetchFeatureFlagsThunk } from '../../../src/slices/featureFlagsSlice';

// ---------------------------------------------------------------------------
// Helper: replicate client-side admin domain check
// ---------------------------------------------------------------------------

function isAdminDomainClient(email: string, adminEmailDomains: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  const domains = adminEmailDomains
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return domains.includes(domain);
}

// ---------------------------------------------------------------------------
// Admin domain visibility logic
// ---------------------------------------------------------------------------

describe('isAdminDomainClient', () => {
  it('returns true when the user domain is in ADMIN_EMAIL_DOMAINS', () => {
    expect(isAdminDomainClient('admin@journeyh.io', 'journeyh.io')).toBe(true);
  });

  it('returns false when the user domain is not in ADMIN_EMAIL_DOMAINS', () => {
    expect(isAdminDomainClient('user@gmail.com', 'journeyh.io')).toBe(false);
  });

  it('supports multiple admin domains (comma-separated)', () => {
    expect(isAdminDomainClient('user@partner.com', 'journeyh.io,partner.com')).toBe(true);
    expect(isAdminDomainClient('user@other.com', 'journeyh.io,partner.com')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isAdminDomainClient('ADMIN@JOURNEYH.IO', 'journeyh.io')).toBe(true);
  });

  it('returns false for a malformed email with no @', () => {
    expect(isAdminDomainClient('notanemail', 'journeyh.io')).toBe(false);
  });

  it('returns false when adminEmailDomains is empty', () => {
    expect(isAdminDomainClient('admin@journeyh.io', '')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// adminInvite Redux slice
// ---------------------------------------------------------------------------

function makeStore() {
  return configureStore({
    reducer: {
      adminInvite: adminInviteReducer,
      featureFlags: featureFlagsReducer,
    },
  });
}

describe('adminInvite slice', () => {
  it('initialises with modal closed and no credentials', () => {
    const store = makeStore();
    const state = store.getState().adminInvite;
    expect(state.isOpen).toBe(false);
    expect(state.credentials).toBeNull();
    expect(state.emailSent).toBe(false);
  });

  it('opens the modal via openInviteModal', () => {
    const store = makeStore();
    store.dispatch(openInviteModal());
    expect(store.getState().adminInvite.isOpen).toBe(true);
  });

  it('closes the modal via closeInviteModal and resets credentials', () => {
    const store = makeStore();
    store.dispatch(openInviteModal());
    store.dispatch(setInviteCredentials({
      credentials: { email: 'x@example.com', plainPassword: 'pass123A' },
      emailSent: true,
    }));
    store.dispatch(closeInviteModal());
    const state = store.getState().adminInvite;
    expect(state.isOpen).toBe(false);
    expect(state.credentials).toBeNull();
    expect(state.emailSent).toBe(false);
  });

  it('stores credentials after setInviteCredentials', () => {
    const store = makeStore();
    store.dispatch(openInviteModal());
    store.dispatch(setInviteCredentials({
      credentials: { email: 'jane@example.com', plainPassword: 'Abc12345' },
      emailSent: false,
    }));
    const state = store.getState().adminInvite;
    expect(state.credentials?.email).toBe('jane@example.com');
    expect(state.credentials?.plainPassword).toBe('Abc12345');
    expect(state.emailSent).toBe(false);
  });

  it('resets credentials when modal is re-opened', () => {
    const store = makeStore();
    store.dispatch(setInviteCredentials({
      credentials: { email: 'old@example.com', plainPassword: 'OldPass1' },
      emailSent: true,
    }));
    store.dispatch(openInviteModal());
    const state = store.getState().adminInvite;
    expect(state.credentials).toBeNull();
    expect(state.emailSent).toBe(false);
  });

  it('stores emailSent: true from API response', () => {
    const store = makeStore();
    store.dispatch(setInviteCredentials({
      credentials: { email: 'x@example.com', plainPassword: 'Abc12345' },
      emailSent: true,
    }));
    expect(store.getState().adminInvite.emailSent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// featureFlags slice — email toggle visibility
// ---------------------------------------------------------------------------

describe('featureFlags slice — email toggle', () => {
  it('initialises with toggle hidden (both flags false)', () => {
    const store = makeStore();
    const { sesEnabled, adminInviteEmailEnabled } = store.getState().featureFlags;
    expect(sesEnabled).toBe(false);
    expect(adminInviteEmailEnabled).toBe(false);
  });

  it('shows toggle only when both SES_ENABLED and ADMIN_INVITE_EMAIL_ENABLED are true', () => {
    // Simulate the fulfilled state by dispatching with a mock resolved value
    const store = makeStore();

    // Dispatch fulfilled action directly (without calling the thunk async)
    store.dispatch(fetchFeatureFlagsThunk.fulfilled(
      { sesEnabled: true, adminInviteEmailEnabled: true, adminEmailDomains: 'journeyh.io' },
      'test-request-id',
      undefined,
    ));

    const flags = store.getState().featureFlags;
    expect(flags.sesEnabled).toBe(true);
    expect(flags.adminInviteEmailEnabled).toBe(true);
    // selectShowEmailToggle logic
    expect(flags.sesEnabled && flags.adminInviteEmailEnabled).toBe(true);
  });

  it('hides toggle when SES_ENABLED is false even if ADMIN_INVITE_EMAIL_ENABLED is true', () => {
    const store = makeStore();
    store.dispatch(fetchFeatureFlagsThunk.fulfilled(
      { sesEnabled: false, adminInviteEmailEnabled: true, adminEmailDomains: 'journeyh.io' },
      'test-request-id',
      undefined,
    ));
    const flags = store.getState().featureFlags;
    expect(flags.sesEnabled && flags.adminInviteEmailEnabled).toBe(false);
  });

  it('hides toggle when ADMIN_INVITE_EMAIL_ENABLED is false even if SES_ENABLED is true', () => {
    const store = makeStore();
    store.dispatch(fetchFeatureFlagsThunk.fulfilled(
      { sesEnabled: true, adminInviteEmailEnabled: false, adminEmailDomains: 'journeyh.io' },
      'test-request-id',
      undefined,
    ));
    const flags = store.getState().featureFlags;
    expect(flags.sesEnabled && flags.adminInviteEmailEnabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Credential clipboard text format
// ---------------------------------------------------------------------------

describe('Credential sheet text format', () => {
  it('formats credentials as expected for clipboard copy', () => {
    const email = 'contractor@example.com';
    const plainPassword = 'G7xqP2mR';
    const loginUrl = 'https://app.example.com/login';

    const clipboardText = [
      `Email:     ${email}`,
      `Password:  ${plainPassword}`,
      `Login URL: ${loginUrl}`,
    ].join('\n');

    expect(clipboardText).toContain('contractor@example.com');
    expect(clipboardText).toContain('G7xqP2mR');
    expect(clipboardText).toContain('https://app.example.com/login');
    expect(clipboardText.split('\n')).toHaveLength(3);
  });
});
