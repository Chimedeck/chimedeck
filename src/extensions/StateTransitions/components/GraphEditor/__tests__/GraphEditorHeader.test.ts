import { describe, expect, it } from 'bun:test';
import { getPresenceBadgeLabel } from '../GraphEditorHeader';

describe('GraphEditorHeader presence helpers', () => {
  it('hides badge when one user is editing', () => {
    expect(getPresenceBadgeLabel(1)).toBeNull();
  });

  it('shows exact count for 2-10 users', () => {
    expect(getPresenceBadgeLabel(2)).toBe('2 users editing');
    expect(getPresenceBadgeLabel(10)).toBe('10 users editing');
  });

  it('caps badge text for 10+ users', () => {
    expect(getPresenceBadgeLabel(11)).toBe('10+ users editing');
  });
});
