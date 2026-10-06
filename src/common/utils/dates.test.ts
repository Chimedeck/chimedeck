import { describe, expect, it } from 'bun:test';
import { localDateKey, parseLocalDate, toLocalDateKey } from './dates';

// These tests guard the two date traps documented in dates.ts:
//   1. slicing an ISO string yields the UTC date, not the local one;
//   2. new Date("YYYY-MM-DD") is UTC midnight, so converting it to local time
//      shifts the day for negative-offset timezones.
// A date-only string must always survive as the same calendar date, regardless
// of the runtime timezone, because drag/resize paths persist and re-read it.

describe('localDateKey', () => {
  it('returns a date-only string verbatim', () => {
    expect(localDateKey('2026-09-15')).toBe('2026-09-15');
    expect(localDateKey('2026-01-01')).toBe('2026-01-01');
    expect(localDateKey('2026-12-31')).toBe('2026-12-31');
  });

  it('does not shift date-only strings across month and year boundaries', () => {
    expect(localDateKey('2026-01-01')).toBe('2026-01-01');
    expect(localDateKey('2026-03-01')).toBe('2026-03-01');
    expect(localDateKey('2026-12-01')).toBe('2026-12-01');
  });

  it('converts a full ISO timestamp to a calendar date', () => {
    expect(localDateKey('2026-09-15T05:00:00.000Z')).toMatch(/^2026-09-1[45]$/);
  });

  it('returns an empty string for unparseable input', () => {
    expect(localDateKey('not-a-date')).toBe('');
  });
});

describe('parseLocalDate', () => {
  it('parses a date-only string to local midnight of that date', () => {
    const d = parseLocalDate('2026-09-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // September
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it('round-trips a date-only string without losing a day', () => {
    // Regression: new Date("2026-09-15") is UTC midnight, which used to shift
    // this back to the 14th west of UTC.
    expect(toLocalDateKey(parseLocalDate('2026-09-15'))).toBe('2026-09-15');
    expect(toLocalDateKey(parseLocalDate('2026-01-01'))).toBe('2026-01-01');
    expect(toLocalDateKey(parseLocalDate('2026-12-31'))).toBe('2026-12-31');
  });
});

describe('toLocalDateKey', () => {
  it('formats a local Date as YYYY-MM-DD with zero padding', () => {
    expect(toLocalDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toLocalDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});
