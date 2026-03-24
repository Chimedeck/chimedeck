// Unit tests for classify() — pure function, no I/O needed.
// Covers all 8 edge cases from the sprint-115 spec.
import { describe, it, expect } from 'bun:test';
import { classify } from '../../../../../../../server/extensions/healthCheck/mods/probe/classify';

const AMBER_MS = 1000; // matches the default HEALTH_CHECK_AMBER_THRESHOLD_MS

describe('classify()', () => {
  // ── Green ──────────────────────────────────────────────────────────────────

  it('returns green for HTTP 200 with fast response time', () => {
    expect(classify({ httpStatus: 200, responseTimeMs: 500, error: null, amberThresholdMs: AMBER_MS })).toBe('green');
  });

  it('returns green for HTTP 201 under the threshold', () => {
    expect(classify({ httpStatus: 201, responseTimeMs: 999, error: null, amberThresholdMs: AMBER_MS })).toBe('green');
  });

  // ── Amber ──────────────────────────────────────────────────────────────────

  it('returns amber for HTTP 200 at exactly the threshold (slow response)', () => {
    expect(classify({ httpStatus: 200, responseTimeMs: 1000, error: null, amberThresholdMs: AMBER_MS })).toBe('amber');
  });

  it('returns amber for HTTP 200 above the threshold', () => {
    expect(classify({ httpStatus: 200, responseTimeMs: 1500, error: null, amberThresholdMs: AMBER_MS })).toBe('amber');
  });

  it('returns amber for HTTP 301 (permanent redirect)', () => {
    expect(classify({ httpStatus: 301, responseTimeMs: 200, error: null, amberThresholdMs: AMBER_MS })).toBe('amber');
  });

  it('returns amber for HTTP 302 (temporary redirect)', () => {
    expect(classify({ httpStatus: 302, responseTimeMs: 200, error: null, amberThresholdMs: AMBER_MS })).toBe('amber');
  });

  it('returns amber for HTTP 307 (temporary redirect)', () => {
    expect(classify({ httpStatus: 307, responseTimeMs: 200, error: null, amberThresholdMs: AMBER_MS })).toBe('amber');
  });

  // ── Red ────────────────────────────────────────────────────────────────────

  it('returns red for HTTP 400 (bad request)', () => {
    expect(classify({ httpStatus: 400, responseTimeMs: 100, error: null, amberThresholdMs: AMBER_MS })).toBe('red');
  });

  it('returns red for HTTP 404 (not found)', () => {
    expect(classify({ httpStatus: 404, responseTimeMs: 100, error: null, amberThresholdMs: AMBER_MS })).toBe('red');
  });

  it('returns red for HTTP 500 (internal server error)', () => {
    expect(classify({ httpStatus: 500, responseTimeMs: 100, error: null, amberThresholdMs: AMBER_MS })).toBe('red');
  });

  it('returns red for HTTP 503 (service unavailable)', () => {
    expect(classify({ httpStatus: 503, responseTimeMs: 100, error: null, amberThresholdMs: AMBER_MS })).toBe('red');
  });

  it('returns red when error is set (timeout)', () => {
    expect(classify({ httpStatus: null, responseTimeMs: 10050, error: 'Timeout after 10050ms', amberThresholdMs: AMBER_MS })).toBe('red');
  });

  it('returns red when error is set (network/DNS failure)', () => {
    expect(classify({ httpStatus: null, responseTimeMs: null, error: 'ENOTFOUND example.invalid', amberThresholdMs: AMBER_MS })).toBe('red');
  });

  it('returns red when httpStatus is null and no error is explicitly set', () => {
    expect(classify({ httpStatus: null, responseTimeMs: null, error: 'SSRF guard blocked', amberThresholdMs: AMBER_MS })).toBe('red');
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it('returns red for 1xx informational status codes', () => {
    expect(classify({ httpStatus: 100, responseTimeMs: 50, error: null, amberThresholdMs: AMBER_MS })).toBe('red');
  });

  it('returns green with responseTimeMs exactly 1 below threshold', () => {
    expect(classify({ httpStatus: 200, responseTimeMs: 999, error: null, amberThresholdMs: AMBER_MS })).toBe('green');
  });

  it('respects a custom amberThresholdMs value', () => {
    // With a 500ms threshold, a 600ms response should be amber
    expect(classify({ httpStatus: 200, responseTimeMs: 600, error: null, amberThresholdMs: 500 })).toBe('amber');
    // …but a 400ms response should be green
    expect(classify({ httpStatus: 200, responseTimeMs: 400, error: null, amberThresholdMs: 500 })).toBe('green');
  });

  it('error takes precedence over httpStatus (treats even 200 with error as red)', () => {
    // This shouldn't happen in practice but the guard should be defensive
    expect(classify({ httpStatus: 200, responseTimeMs: 100, error: 'Unexpected error', amberThresholdMs: AMBER_MS })).toBe('red');
  });
});
