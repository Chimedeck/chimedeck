import { describe, it, expect, mock, beforeEach } from 'bun:test';

describe('checkAndWriteSnapshot (policy)', () => {
  it('exports checkAndWriteSnapshot function', async () => {
    const mod = await import('./policy');
    expect(typeof mod.checkAndWriteSnapshot).toBe('function');
  });
});
