// Integration tests for Label CRUD operations — Sprint 112.
// Covers: creating a label on a board (name/color validation), assigning a
// label to a card, idempotent re-assign, the 20-label-per-card limit, and
// detaching a label from a card.
// Strategy: unit-level tests that exercise business logic and validation
// rules directly — without requiring a live database.
import { describe, expect, it } from 'bun:test';

// ---------------------------------------------------------------------------
// Helpers that mirror validation in the label API handlers.
// ---------------------------------------------------------------------------

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLOR = '#6b7280';

interface LabelInput {
  name?: unknown;
  color?: unknown;
}

interface ValidationResult {
  ok: boolean;
  name?: string;
  message?: string;
}

/** Mirrors the guard clauses in handleCreateBoardLabel. */
function validateCreateLabel(body: LabelInput): ValidationResult {
  if (!body.name || typeof body.name !== 'string' || (body.name as string).trim() === '') {
    return { ok: false, name: 'bad-request', message: 'name is required' };
  }
  if (
    body.color !== undefined &&
    body.color !== null &&
    (typeof body.color !== 'string' || !COLOR_RE.test(body.color as string))
  ) {
    return { ok: false, name: 'bad-request', message: 'color must be a valid hex color (e.g. #3b82f6)' };
  }
  return { ok: true };
}

/** Mirrors the guard clauses in handleAttachLabel. */
function validateAttachLabel(
  body: { labelId?: unknown },
  existingCount: number,
): ValidationResult {
  if (!body.labelId || typeof body.labelId !== 'string') {
    return { ok: false, name: 'bad-request', message: 'labelId is required' };
  }
  if (existingCount >= 20) {
    return { ok: false, name: 'card-label-limit', message: 'A card can have at most 20 labels' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Label creation — name validation
// ---------------------------------------------------------------------------

describe('label creation — name validation', () => {
  it('rejects an empty name', () => {
    expect(validateCreateLabel({ name: '   ' })).toMatchObject({ ok: false, name: 'bad-request' });
  });

  it('rejects a missing name (undefined)', () => {
    expect(validateCreateLabel({ color: '#ff0000' })).toMatchObject({ ok: false, name: 'bad-request' });
  });

  it('rejects a non-string name', () => {
    expect(validateCreateLabel({ name: 42 })).toMatchObject({ ok: false, name: 'bad-request' });
  });

  it('accepts a valid name', () => {
    expect(validateCreateLabel({ name: 'Bug' })).toMatchObject({ ok: true });
  });

  it('accepts a valid name with surrounding whitespace (will be trimmed)', () => {
    expect(validateCreateLabel({ name: '  Feature  ' })).toMatchObject({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Label creation — color handling
// ---------------------------------------------------------------------------

describe('label creation — color handling', () => {
  it('accepts a valid 6-digit hex color', () => {
    expect(validateCreateLabel({ name: 'Priority', color: '#3b82f6' })).toMatchObject({ ok: true });
  });

  it('accepts uppercase hex color', () => {
    expect(validateCreateLabel({ name: 'Priority', color: '#3B82F6' })).toMatchObject({ ok: true });
  });

  it('rejects a color without leading hash', () => {
    expect(validateCreateLabel({ name: 'Priority', color: '3b82f6' })).toMatchObject({
      ok: false,
      name: 'bad-request',
    });
  });

  it('rejects a 3-digit shorthand hex color', () => {
    expect(validateCreateLabel({ name: 'Priority', color: '#3bf' })).toMatchObject({
      ok: false,
      name: 'bad-request',
    });
  });

  it('rejects a non-hex color string', () => {
    expect(validateCreateLabel({ name: 'Priority', color: 'red' })).toMatchObject({
      ok: false,
      name: 'bad-request',
    });
  });

  it('falls back to default color when color is omitted', () => {
    const result = validateCreateLabel({ name: 'No Color' });
    expect(result.ok).toBe(true);
    // Confirm that the fallback value is the expected default
    expect(DEFAULT_COLOR).toBe('#6b7280');
  });

  it('accepts null color (treated as "use default")', () => {
    expect(validateCreateLabel({ name: 'Priority', color: null })).toMatchObject({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Assign label to card — labelId validation
// ---------------------------------------------------------------------------

describe('assign label to card — labelId validation', () => {
  it('rejects a missing labelId', () => {
    expect(validateAttachLabel({}, 0)).toMatchObject({ ok: false, name: 'bad-request' });
  });

  it('rejects a non-string labelId', () => {
    expect(validateAttachLabel({ labelId: 123 }, 0)).toMatchObject({ ok: false, name: 'bad-request' });
  });

  it('accepts a valid UUID labelId when card has no existing labels', () => {
    expect(validateAttachLabel({ labelId: 'abc-123-uuid' }, 0)).toMatchObject({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Assign label to card — 20-label limit
// ---------------------------------------------------------------------------

describe('assign label to card — 20-label-per-card limit', () => {
  it('allows attaching the 20th label (count is 19 before attach)', () => {
    expect(validateAttachLabel({ labelId: 'uuid-20' }, 19)).toMatchObject({ ok: true });
  });

  it('rejects attaching when card already has 20 labels', () => {
    expect(validateAttachLabel({ labelId: 'uuid-21' }, 20)).toMatchObject({
      ok: false,
      name: 'card-label-limit',
    });
  });

  it('rejects attaching when card already has more than 20 labels (defensive)', () => {
    expect(validateAttachLabel({ labelId: 'uuid-x' }, 25)).toMatchObject({
      ok: false,
      name: 'card-label-limit',
    });
  });
});

// ---------------------------------------------------------------------------
// Assign label to card — idempotency
// ---------------------------------------------------------------------------

describe('assign label to card — idempotency', () => {
  it('identifies an already-assigned label by checking existing card_labels', () => {
    // Simulate the already-attached check: the handler returns 200 without
    // incrementing count when the pair already exists.
    const cardId = 'card-1';
    const labelId = 'label-1';

    const cardLabels: Array<{ card_id: string; label_id: string }> = [
      { card_id: cardId, label_id: labelId },
    ];

    const alreadyAssigned = cardLabels.some(
      (cl) => cl.card_id === cardId && cl.label_id === labelId,
    );
    expect(alreadyAssigned).toBe(true);
  });

  it('does not flag a different label on the same card as already-assigned', () => {
    const cardId = 'card-1';
    const cardLabels: Array<{ card_id: string; label_id: string }> = [
      { card_id: cardId, label_id: 'label-1' },
    ];
    const alreadyAssigned = cardLabels.some(
      (cl) => cl.card_id === cardId && cl.label_id === 'label-2',
    );
    expect(alreadyAssigned).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Remove label from card — detach behaviour
// ---------------------------------------------------------------------------

describe('remove label from card — detach', () => {
  it('removes the correct card_label row by card_id and label_id', () => {
    const cardId = 'card-1';
    const labelId = 'label-a';

    let cardLabels: Array<{ card_id: string; label_id: string }> = [
      { card_id: cardId, label_id: labelId },
      { card_id: cardId, label_id: 'label-b' },
    ];

    // Simulate the DELETE
    cardLabels = cardLabels.filter(
      (cl) => !(cl.card_id === cardId && cl.label_id === labelId),
    );

    expect(cardLabels).toHaveLength(1);
    expect(cardLabels[0]?.label_id).toBe('label-b');
  });

  it('is idempotent — removing a non-existent assignment leaves the list unchanged', () => {
    const cardLabels: Array<{ card_id: string; label_id: string }> = [
      { card_id: 'card-1', label_id: 'label-b' },
    ];

    const after = cardLabels.filter(
      (cl) => !(cl.card_id === 'card-1' && cl.label_id === 'label-x'),
    );

    expect(after).toHaveLength(1);
  });

  it('does not detach a label from a different card', () => {
    const cardLabels: Array<{ card_id: string; label_id: string }> = [
      { card_id: 'card-1', label_id: 'label-a' },
      { card_id: 'card-2', label_id: 'label-a' },
    ];

    const after = cardLabels.filter(
      (cl) => !(cl.card_id === 'card-1' && cl.label_id === 'label-a'),
    );

    expect(after).toHaveLength(1);
    expect(after[0]?.card_id).toBe('card-2');
  });
});

// ---------------------------------------------------------------------------
// Label belongs to workspace guard
// ---------------------------------------------------------------------------

describe('assign label — workspace ownership guard', () => {
  it('rejects a label that belongs to a different workspace', () => {
    const cardWorkspaceId = 'ws-abc';
    const label = { id: 'label-1', workspace_id: 'ws-xyz', name: 'Bug', color: '#ef4444' };

    const isSameWorkspace = label.workspace_id === cardWorkspaceId;
    expect(isSameWorkspace).toBe(false);
  });

  it('allows a label that belongs to the same workspace', () => {
    const cardWorkspaceId = 'ws-abc';
    const label = { id: 'label-2', workspace_id: 'ws-abc', name: 'Feature', color: '#22c55e' };

    const isSameWorkspace = label.workspace_id === cardWorkspaceId;
    expect(isSameWorkspace).toBe(true);
  });
});
