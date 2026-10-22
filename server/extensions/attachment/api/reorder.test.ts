// Unit tests for the attachment reorder validation helper.
import { describe, expect, test } from 'bun:test';
import { validateReorderOrder } from './reorder';

const cardAttachments = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }];

describe('validateReorderOrder', () => {
  test('accepts a complete permutation of the card’s attachments', () => {
    expect(validateReorderOrder(['a2', 'a3', 'a1'], cardAttachments)).toEqual({ ok: true });
  });

  test('rejects missing/non-array order', () => {
    expect(validateReorderOrder(undefined, cardAttachments).ok).toBe(false);
    expect(validateReorderOrder('a1', cardAttachments).ok).toBe(false);
  });

  test('rejects count mismatch (too few / too many)', () => {
    const few = validateReorderOrder(['a1', 'a2'], cardAttachments);
    expect(few).toMatchObject({ ok: false, name: 'reorder-count-mismatch' });

    const many = validateReorderOrder(['a1', 'a2', 'a3', 'a4'], cardAttachments);
    expect(many).toMatchObject({ ok: false, name: 'reorder-count-mismatch' });
  });

  test('rejects duplicate ids (the [a, a] case), even when count matches', () => {
    const res = validateReorderOrder(['a1', 'a1', 'a2'], [
      { id: 'a1' },
      { id: 'a2' },
      { id: 'a3' },
    ]);
    expect(res).toMatchObject({ ok: false, name: 'reorder-duplicate-attachment' });
  });

  test('rejects ids that do not belong to the card', () => {
    const res = validateReorderOrder(['a1', 'a2', 'aX'], cardAttachments);
    expect(res).toMatchObject({ ok: false, name: 'attachment-card-mismatch' });
  });

  test('rejects empty order for a non-empty card', () => {
    const res = validateReorderOrder([], cardAttachments);
    expect(res).toMatchObject({ ok: false, name: 'reorder-count-mismatch' });
  });

  test('accepts an empty order for an empty card', () => {
    expect(validateReorderOrder([], [])).toEqual({ ok: true });
  });
});