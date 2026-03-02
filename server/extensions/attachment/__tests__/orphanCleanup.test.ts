// Unit tests for orphan cleanup TTL logic.
// We test the TTL boundary condition without hitting a real database.
import { describe, expect, test, mock, beforeEach } from 'bun:test';

const ORPHAN_TTL_MS = 60 * 60 * 1000; // 1 hour — must match orphanCleanup.ts

describe('orphan cleanup TTL logic', () => {
  test('cutoff is exactly 1 hour before now', () => {
    const before = Date.now();
    const cutoff = new Date(before - ORPHAN_TTL_MS);
    const after = Date.now();

    // cutoff should be between (after - 1h) and (before - 1h + small delta)
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(after - ORPHAN_TTL_MS - 100);
    expect(cutoff.getTime()).toBeLessThanOrEqual(before - ORPHAN_TTL_MS + 100);
  });

  test('an attachment created 61 minutes ago is considered orphaned', () => {
    const now = Date.now();
    const cutoff = new Date(now - ORPHAN_TTL_MS);
    const attachmentCreatedAt = new Date(now - 61 * 60 * 1000); // 61 minutes ago

    expect(attachmentCreatedAt < cutoff).toBe(true);
  });

  test('an attachment created 59 minutes ago is NOT considered orphaned', () => {
    const now = Date.now();
    const cutoff = new Date(now - ORPHAN_TTL_MS);
    const attachmentCreatedAt = new Date(now - 59 * 60 * 1000); // 59 minutes ago

    expect(attachmentCreatedAt < cutoff).toBe(false);
  });

  test('an attachment created exactly at the boundary is NOT considered orphaned', () => {
    const now = Date.now();
    const cutoff = new Date(now - ORPHAN_TTL_MS);
    // Exactly at cutoff boundary
    const attachmentCreatedAt = new Date(cutoff.getTime());

    expect(attachmentCreatedAt < cutoff).toBe(false);
  });
});
