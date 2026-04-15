import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { dispatchWebhook } from '../../../../../../server/extensions/webhooks/mods/dispatch';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeKnex({
  deliveryId = 'delivery-uuid-1',
  insertShouldReject = false,
  updateShouldReject = false,
}: {
  deliveryId?: string;
  insertShouldReject?: boolean;
  updateShouldReject?: boolean;
} = {}) {
  const updates: Record<string, unknown>[] = [];

  const knex = (table: string) => {
    if (table === 'webhook_deliveries') {
      return {
        insert: (_row: unknown) => ({
          returning: (_col: string) =>
            insertShouldReject
              ? Promise.reject(new Error('DB insert failed'))
              : Promise.resolve([{ id: deliveryId }]),
        }),
        where: (_cond: unknown) => ({
          update: (data: Record<string, unknown>) => {
            updates.push(data);
            return updateShouldReject
              ? Promise.reject(new Error('DB update failed'))
              : Promise.resolve(1);
          },
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  };

  return { knex: knex as unknown as import('knex').Knex, updates };
}

const BASE_PARAMS = {
  endpoint: 'https://example.com/hook',
  signingSecret: 'super-secret',
  eventType: 'card.created' as const,
  payload: { cardId: 'abc-123' },
  webhookId: 'webhook-uuid-1',
};

// Small wait so the fire-and-forget IIFE can complete.
const flush = () => new Promise((r) => setTimeout(r, 50));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('dispatchWebhook()', () => {
  let fetchMock: ReturnType<typeof mock>;

  beforeEach(() => {
    fetchMock = mock(() =>
      Promise.resolve(
        new Response('ok', { status: 200 }),
      ),
    );
    // Replace global fetch for the duration of each test.
    (globalThis as unknown as Record<string, unknown>).fetch = fetchMock;
  });

  afterEach(() => {
    fetchMock.mockRestore?.();
  });

  it('inserts a delivery row and resolves immediately (does not await fetch)', async () => {
    let fetchCalled = false;
    (globalThis as unknown as Record<string, unknown>).fetch = mock(
      () =>
        new Promise((resolve) => {
          // Delay fetch to confirm dispatchWebhook has already resolved.
          setTimeout(() => {
            fetchCalled = true;
            resolve(new Response('ok', { status: 200 }));
          }, 100);
        }),
    );

    const { knex } = makeKnex();
    const start = Date.now();
    await dispatchWebhook({ ...BASE_PARAMS, knex });
    const elapsed = Date.now() - start;

    // Should resolve well before fetch completes (< 80 ms).
    expect(elapsed).toBeLessThan(80);
    // fetch should not have resolved yet at return time.
    expect(fetchCalled).toBe(false);
  });

  it('sets the delivery row status to delivered on HTTP 200', async () => {
    const { knex, updates } = makeKnex();
    await dispatchWebhook({ ...BASE_PARAMS, knex });
    await flush();

    expect(updates.length).toBeGreaterThanOrEqual(1);
    expect(updates[0].status).toBe('delivered');
    expect(updates[0].http_status).toBe(200);
  });

  it('sets the delivery row status to failed on non-2xx HTTP response', async () => {
    (globalThis as unknown as Record<string, unknown>).fetch = mock(() =>
      Promise.resolve(new Response('Not Found', { status: 404 })),
    );

    const { knex, updates } = makeKnex();
    await dispatchWebhook({ ...BASE_PARAMS, knex });
    await flush();

    expect(updates[0].status).toBe('failed');
    expect(updates[0].http_status).toBe(404);
  });

  it('sets the delivery row status to failed when fetch throws (network error)', async () => {
    (globalThis as unknown as Record<string, unknown>).fetch = mock(() =>
      Promise.reject(new Error('ECONNREFUSED')),
    );

    const { knex, updates } = makeKnex();
    await dispatchWebhook({ ...BASE_PARAMS, knex });
    await flush();

    expect(updates[0].status).toBe('failed');
  });

  it('sends a POST request to the endpoint with Webhook-Signature and Content-Type headers', async () => {
    let capturedRequest: RequestInit | undefined;
    (globalThis as unknown as Record<string, unknown>).fetch = mock(
      (_url: string, init: RequestInit) => {
        capturedRequest = init;
        return Promise.resolve(new Response('ok', { status: 200 }));
      },
    );

    const { knex } = makeKnex();
    await dispatchWebhook({ ...BASE_PARAMS, knex });
    await flush();

    expect(capturedRequest?.method).toBe('POST');
    const headers = capturedRequest?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Webhook-Signature']).toMatch(/^t=\d+,v0=[0-9a-f]{64}$/);
  });

  it('sends body containing event and data fields', async () => {
    let capturedBody = '';
    (globalThis as unknown as Record<string, unknown>).fetch = mock(
      (_url: string, init: RequestInit) => {
        capturedBody = init.body as string;
        return Promise.resolve(new Response('ok', { status: 200 }));
      },
    );

    const { knex } = makeKnex();
    await dispatchWebhook({ ...BASE_PARAMS, knex });
    await flush();

    const parsed = JSON.parse(capturedBody);
    expect(parsed.event).toBe(BASE_PARAMS.eventType);
    expect(parsed.data).toEqual(BASE_PARAMS.payload);
  });

  it('does not throw if the DB update after fetch fails', async () => {
    const { knex } = makeKnex({ updateShouldReject: true });
    // Should not throw even when the update rejects.
    await expect(dispatchWebhook({ ...BASE_PARAMS, knex })).resolves.toBeUndefined();
    await flush();
  });
});
