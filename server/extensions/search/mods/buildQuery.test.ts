// server/extensions/search/mods/buildQuery.test.ts
import { describe, it, expect } from 'bun:test';
import { buildQuery } from './buildQuery';

describe('buildQuery', () => {
  it('returns null for empty string', () => {
    expect(buildQuery({ q: '' })).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(buildQuery({ q: '   ' })).toBeNull();
  });

  it('converts a single word to a prefix tsquery', () => {
    expect(buildQuery({ q: 'hello' })).toBe('hello:*');
  });

  it('joins multiple words with AND', () => {
    expect(buildQuery({ q: 'foo bar' })).toBe('foo:* & bar:*');
  });

  it('sanitizes tsquery special char &', () => {
    const result = buildQuery({ q: 'foo & bar' });
    expect(result).toBe('foo:* & bar:*');
  });

  it('sanitizes tsquery special char |', () => {
    const result = buildQuery({ q: 'foo | bar' });
    expect(result).toBe('foo:* & bar:*');
  });

  it('sanitizes tsquery special char !', () => {
    const result = buildQuery({ q: '!foo' });
    expect(result).toBe('foo:*');
  });

  it('sanitizes tsquery special chars ( and )', () => {
    const result = buildQuery({ q: '(foo bar)' });
    expect(result).toBe('foo:* & bar:*');
  });

  it('sanitizes tsquery special char *', () => {
    const result = buildQuery({ q: 'foo*' });
    expect(result).toBe('foo:*');
  });

  it("sanitizes tsquery special char '", () => {
    const result = buildQuery({ q: "it's" });
    // apostrophe splits into two tokens → "it:* & s:*"
    expect(result).toBe('it:* & s:*');
  });

  it('handles mixed special chars and words', () => {
    const result = buildQuery({ q: 'alpha!beta&gamma' });
    // special chars become spaces → ["alpha", "beta", "gamma"]
    expect(result).toBe('alpha:* & beta:* & gamma:*');
  });
});
