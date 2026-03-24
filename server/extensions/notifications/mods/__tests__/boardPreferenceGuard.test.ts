import { describe, expect, test } from 'bun:test';

// ---------------------------------------------------------------------------
// Test the pure selectChannels helper directly — no db mocking required.
// This avoids cross-file module-cache contamination in Bun's test runner.
// ---------------------------------------------------------------------------
import { selectChannels } from '../boardPreferenceGuard';

describe('selectChannels (pure cascade logic)', () => {
  // T1: Board override beats user master preference
  test('T1: board row present — returns board values (in-app off)', () => {
    const result = selectChannels(
      { in_app_enabled: false, email_enabled: true }, // board override
      { in_app_enabled: true, email_enabled: true },  // user row (ignored)
    );
    expect(result).toEqual({ inApp: false, email: true });
  });

  test('T1b: board row present — returns board values (email off)', () => {
    const result = selectChannels(
      { in_app_enabled: true, email_enabled: false },
      { in_app_enabled: true, email_enabled: true },
    );
    expect(result).toEqual({ inApp: true, email: false });
  });

  test('T1c: board row with both channels off overrides user both-on', () => {
    const result = selectChannels(
      { in_app_enabled: false, email_enabled: false },
      { in_app_enabled: true, email_enabled: true },
    );
    expect(result).toEqual({ inApp: false, email: false });
  });

  // T2: No board override → falls back to user preference
  test('T2: no board row — returns user values (both off)', () => {
    const result = selectChannels(null, { in_app_enabled: false, email_enabled: false });
    expect(result).toEqual({ inApp: false, email: false });
  });

  test('T2b: no board row — returns user values (mixed)', () => {
    const result = selectChannels(null, { in_app_enabled: true, email_enabled: false });
    expect(result).toEqual({ inApp: true, email: false });
  });

  test('T2c: no board row — undefined treated same as null', () => {
    const result = selectChannels(undefined, { in_app_enabled: false, email_enabled: true });
    expect(result).toEqual({ inApp: false, email: true });
  });

  // T3: No user row and no board row → default (true, true)
  test('T3: no board row and no user row — defaults to both enabled', () => {
    const result = selectChannels(null, null);
    expect(result).toEqual({ inApp: true, email: true });
  });

  test('T3b: undefined/undefined — defaults to both enabled', () => {
    const result = selectChannels(undefined, undefined);
    expect(result).toEqual({ inApp: true, email: true });
  });

  // T6/T7: Global and board-global toggles are the CALLER's responsibility.
  // selectChannels only computes the per-type channel resolution.
  // When board row is present, it always wins regardless of user row.
  test('T6/T7: board-type row always wins — caller applies global guard before invoking', () => {
    const result = selectChannels(
      { in_app_enabled: true, email_enabled: true },
      null,
    );
    expect(result).toEqual({ inApp: true, email: true });
  });
});
