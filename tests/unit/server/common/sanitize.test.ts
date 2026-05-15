import { describe, it, expect } from 'bun:test';
import { sanitizeText } from '../../../../server/common/sanitize';

describe('sanitizeText()', () => {
  it('preserves literal ampersands in plain text', () => {
    expect(sanitizeText('R&D roadmap')).toBe('R&D roadmap');
  });

  it('normalizes encoded ampersands back to literal ampersands', () => {
    expect(sanitizeText('R&amp;D roadmap')).toBe('R&D roadmap');
  });

  it('removes tags while preserving non-tag text with ampersands', () => {
    expect(sanitizeText('<b>R&D</b> <script>alert(1)</script>team')).toBe('R&D team');
  });
});
