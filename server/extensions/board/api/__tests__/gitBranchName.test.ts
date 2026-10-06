// Unit tests for the git branch-name validator used by PATCH /boards/:id/settings/integrations.
// Scenarios mirror git check-ref-format(1) plus the specific cases the review flagged.
import { describe, expect, test } from 'bun:test';
import { isValidGitBranchName } from '../integrations/patch';

describe('isValidGitBranchName', () => {
  // Accepts — real-world branch names
  test('accepts ordinary and namespaced branch names', () => {
    const ok = [
      'main',
      'feature/login',
      'release/1.2.3',
      'bugfix/JIRA-1234_short-name',
      'feature/2fa-totp',
      'release/2.0-with.dots',
      'user/alice/patch-01',
    ];
    for (const name of ok) expect(isValidGitBranchName(name)).toBe(true);
  });

  // Rejects — the review's cited cases
  test('rejects .hidden (component starting with a dot)', () => {
    expect(isValidGitBranchName('.hidden')).toBe(false);
  });

  test('rejects feature/ (trailing slash / empty component)', () => {
    expect(isValidGitBranchName('feature/')).toBe(false);
  });

  test('rejects feature//x (empty component between slashes)', () => {
    expect(isValidGitBranchName('feature//x')).toBe(false);
  });

  test('rejects feature/.hidden (embedded dot-component)', () => {
    expect(isValidGitBranchName('feature/.hidden')).toBe(false);
  });

  // Rejects — remaining check-ref-format rules
  test('rejects empty and oversized names', () => {
    expect(isValidGitBranchName('')).toBe(false);
    expect(isValidGitBranchName('a'.repeat(256))).toBe(false);
  });

  test('rejects forbidden characters and control chars', () => {
    const bad = [
      'space branch',
      'tilde~1',
      'caret^2',
      'colon:fix',
      'quest?ion',
      'star*glob',
      'brack[et]',
      'back\\slash',
      'ctrl\x01char',
    ];
    for (const name of bad) expect(isValidGitBranchName(name)).toBe(false);
  });

  test('rejects .. sequences and @{ patterns', () => {
    expect(isValidGitBranchName('a..b')).toBe(false);
    expect(isValidGitBranchName('feature/@{nope}')).toBe(false);
  });

  test('rejects single @ and trailing-dot names', () => {
    expect(isValidGitBranchName('@')).toBe(false);
    expect(isValidGitBranchName('feature/foo.')).toBe(false);
  });

  test('rejects components ending in .lock (case-insensitive)', () => {
    expect(isValidGitBranchName('foo.lock')).toBe(false);
    expect(isValidGitBranchName('feature/bar.lock/baz')).toBe(false);
    expect(isValidGitBranchName('feature/PAYMENTS.LOCK/x')).toBe(false);
    // A component merely CONTAINING 'LOCK' is legal (git's real rule).
    expect(isValidGitBranchName('feature/LOCK/qux')).toBe(true);
  });

  test('rejects leading dash or slash', () => {
    expect(isValidGitBranchName('-flag-style')).toBe(false);
    expect(isValidGitBranchName('/rooted')).toBe(false);
  });
});