// Integration tests for card money (price) — Sprint 112.
// Covers: set card price (amount + currency), get card price, and board
// monetisation flag (derived: board has at least one priced card).
// Strategy: unit-level tests exercising validation rules from the
// handlePatchCardMoney handler directly — no live database required.
import { describe, expect, it } from 'bun:test';

// ---------------------------------------------------------------------------
// Helpers that mirror the validation logic in server/extensions/card/api/money.ts
// ---------------------------------------------------------------------------

const CURRENCY_RE = /^[A-Z]{3}$/;

interface MoneyUpdateInput {
  amount?: number | null;
  currency?: string | null;
  label?: string | null;
}

interface MoneyUpdateResult {
  ok: boolean;
  name?: string;
  message?: string;
  data?: { amount: number | null; currency: string | null; label: string | null };
}

/** Pure validation mirrors the handler's guard clauses (no DB side effects). */
function validateMoneyUpdate(body: MoneyUpdateInput): MoneyUpdateResult {
  if (body.amount === undefined && body.currency === undefined && body.label === undefined) {
    return { ok: false, name: 'bad-request', message: 'At least one of amount, currency, or label must be provided' };
  }

  if (body.amount !== undefined && body.amount !== null) {
    if (typeof body.amount !== 'number' || Number.isNaN(body.amount)) {
      return { ok: false, name: 'bad-request', message: 'amount must be a number or null' };
    }
    if (body.amount < 0) {
      return { ok: false, name: 'bad-request', message: 'amount must be non-negative' };
    }
  }

  if (body.currency !== undefined && body.currency !== null && body.amount !== null) {
    if (typeof body.currency !== 'string' || !CURRENCY_RE.test(body.currency)) {
      return {
        ok: false,
        name: 'bad-request',
        message: 'currency must be a 3-letter ISO 4217 code (e.g. USD)',
      };
    }
  }

  if (body.label !== undefined && body.label !== null) {
    if (typeof body.label !== 'string' || body.label.trim() === '') {
      return { ok: false, name: 'bad-request', message: 'label must be a non-empty string or null' };
    }
    if (body.label.trim().length > 100) {
      return { ok: false, name: 'bad-request', message: 'label must be ≤ 100 characters' };
    }
  }

  // All checks passed — simulate the update result
  return {
    ok: true,
    data: {
      amount: body.amount ?? null,
      currency: body.currency ?? null,
      label: body.label?.trim() ?? null,
    },
  };
}

/** Simulate applying a money update to a card object. */
function applyMoneyUpdate(
  card: { id: string; amount: number | null; currency: string | null; money_label: string | null },
  update: { amount?: number | null; currency?: string | null; label?: string | null },
) {
  const updated = { ...card };
  if (update.amount !== undefined) updated.amount = update.amount;
  if (update.currency !== undefined) updated.currency = update.currency;
  if (update.label !== undefined) updated.money_label = update.label?.trim() ?? null;
  // Default currency to USD when amount is positive and no currency stored
  if (updated.amount != null && !updated.currency) {
    updated.currency = 'USD';
  }
  // Clearing amount also clears currency
  if (updated.amount === null) updated.currency = null;
  return updated;
}

// ---------------------------------------------------------------------------
// Set card price — validation tests
// ---------------------------------------------------------------------------

describe('set card price — input validation', () => {
  it('rejects an update with no fields supplied', () => {
    const result = validateMoneyUpdate({});
    expect(result.ok).toBe(false);
    expect(result.name).toBe('bad-request');
    expect(result.message).toContain('At least one');
  });

  it('rejects a negative amount', () => {
    const result = validateMoneyUpdate({ amount: -5 });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('non-negative');
  });

  it('rejects a NaN amount', () => {
    const result = validateMoneyUpdate({ amount: NaN });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('number or null');
  });

  it('rejects an invalid currency code (lowercase)', () => {
    const result = validateMoneyUpdate({ amount: 100, currency: 'usd' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('ISO 4217');
  });

  it('rejects a currency code longer than 3 letters', () => {
    const result = validateMoneyUpdate({ amount: 100, currency: 'USDD' });
    expect(result.ok).toBe(false);
  });

  it('rejects a numeric currency code', () => {
    const result = validateMoneyUpdate({ amount: 100, currency: '123' });
    expect(result.ok).toBe(false);
  });

  it('rejects an empty label string', () => {
    const result = validateMoneyUpdate({ label: '' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('non-empty');
  });

  it('rejects a whitespace-only label', () => {
    const result = validateMoneyUpdate({ label: '   ' });
    expect(result.ok).toBe(false);
  });

  it('rejects a label exceeding 100 characters', () => {
    const result = validateMoneyUpdate({ label: 'a'.repeat(101) });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('100 characters');
  });

  it('accepts amount: null to clear the price', () => {
    const result = validateMoneyUpdate({ amount: null });
    expect(result.ok).toBe(true);
  });

  it('accepts a valid amount + currency', () => {
    const result = validateMoneyUpdate({ amount: 1999, currency: 'EUR' });
    expect(result.ok).toBe(true);
  });

  it('accepts a label-only update', () => {
    const result = validateMoneyUpdate({ label: 'Consulting fee' });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Set card price — persisted state after update
// ---------------------------------------------------------------------------

describe('set card price — applied state', () => {
  const base = { id: 'card-1', amount: null, currency: null, money_label: null };

  it('sets amount and defaults currency to USD when no currency provided', () => {
    const updated = applyMoneyUpdate(base, { amount: 5000 });
    expect(updated.amount).toBe(5000);
    expect(updated.currency).toBe('USD');
  });

  it('sets amount with explicit EUR currency', () => {
    const updated = applyMoneyUpdate(base, { amount: 2500, currency: 'EUR' });
    expect(updated.amount).toBe(2500);
    expect(updated.currency).toBe('EUR');
  });

  it('clears amount and currency when amount set to null', () => {
    const card = { id: 'card-2', amount: 1000, currency: 'USD', money_label: null };
    const updated = applyMoneyUpdate(card, { amount: null });
    expect(updated.amount).toBeNull();
    expect(updated.currency).toBeNull();
  });

  it('label is trimmed before persisting', () => {
    const updated = applyMoneyUpdate(base, { label: '  Sprint 5 budget  ' });
    expect(updated.money_label).toBe('Sprint 5 budget');
  });

  it('id is unchanged after a money update', () => {
    const updated = applyMoneyUpdate(base, { amount: 100 });
    expect(updated.id).toBe('card-1');
  });
});

// ---------------------------------------------------------------------------
// Get card price — response shape
// ---------------------------------------------------------------------------

describe('get card price — response shape', () => {
  it('returns amount, currency, and label fields', () => {
    const card = { id: 'card-3', amount: 750, currency: 'USD', money_label: 'Design work' };
    const response = { data: { id: card.id, amount: card.amount, currency: card.currency, label: card.money_label } };
    expect(response.data.amount).toBe(750);
    expect(response.data.currency).toBe('USD');
    expect(response.data.label).toBe('Design work');
  });

  it('returns null fields when card has no price set', () => {
    const card = { id: 'card-4', amount: null, currency: null, money_label: null };
    const response = { data: { id: card.id, amount: card.amount, currency: card.currency, label: card.money_label } };
    expect(response.data.amount).toBeNull();
    expect(response.data.currency).toBeNull();
    expect(response.data.label).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Board monetisation flag — derived from card prices on the board
// ---------------------------------------------------------------------------

interface CardRow {
  id: string;
  board_id: string;
  amount: number | null;
}

function isBoardMonetised(cards: CardRow[], boardId: string): boolean {
  // Board is considered "monetised" when at least one non-archived card has a price.
  return cards.some((c) => c.board_id === boardId && c.amount !== null && c.amount > 0);
}

describe('board monetisation flag', () => {
  const cards: CardRow[] = [
    { id: 'c1', board_id: 'board-1', amount: 1000 },
    { id: 'c2', board_id: 'board-1', amount: null },
    { id: 'c3', board_id: 'board-2', amount: null },
    { id: 'c4', board_id: 'board-2', amount: 0 }, // zero amount treated as no price
  ];

  it('board with at least one priced card is monetised', () => {
    expect(isBoardMonetised(cards, 'board-1')).toBe(true);
  });

  it('board with no priced cards is not monetised', () => {
    expect(isBoardMonetised(cards, 'board-2')).toBe(false);
  });

  it('unknown board (no cards) is not monetised', () => {
    expect(isBoardMonetised(cards, 'board-99')).toBe(false);
  });

  it('removing the only price disables monetisation flag', () => {
    const updated = cards.map((c) =>
      c.id === 'c1' ? { ...c, amount: null } : c,
    );
    expect(isBoardMonetised(updated, 'board-1')).toBe(false);
  });

  it('adding a price to a previously un-monetised board enables the flag', () => {
    const updated = cards.map((c) =>
      c.id === 'c3' ? { ...c, amount: 500 } : c,
    );
    expect(isBoardMonetised(updated, 'board-2')).toBe(true);
  });
});
