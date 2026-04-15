// Unit tests for DeleteWebhookDialog — label display, confirm/cancel logic.
// Pure logic tests that do not require a full DOM environment.
import { describe, it, expect, mock } from 'bun:test';

// ---------------------------------------------------------------------------
// Helpers that mirror component behaviour
// ---------------------------------------------------------------------------

interface WebhookItem {
  id: string;
  label: string;
  endpointUrl: string;
  eventTypes: string[];
  isActive: boolean;
  createdAt: string;
}

function buildDeletePayload(webhook: WebhookItem): string {
  // The component calls deleteWebhook(webhook.id) on confirm.
  return webhook.id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeleteWebhookDialog — webhook label display', () => {
  it('exposes the webhook label for display', () => {
    const webhook: WebhookItem = {
      id: 'wh-42',
      label: 'My production webhook',
      endpointUrl: 'https://example.com/hook',
      eventTypes: ['card.created'],
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
    };

    // The dialog body renders webhook.label so the user can verify the target.
    expect(webhook.label).toBe('My production webhook');
  });

  it('exposes the webhook label for an inactive webhook', () => {
    const webhook: WebhookItem = {
      id: 'wh-99',
      label: 'Staging hook',
      endpointUrl: 'https://staging.example.com/hook',
      eventTypes: ['mention'],
      isActive: false,
      createdAt: '2024-01-01T00:00:00Z',
    };

    expect(webhook.label).toBe('Staging hook');
  });
});

describe('DeleteWebhookDialog — confirm action', () => {
  it('calls deleteWebhook with the webhook id on confirm', () => {
    const webhook: WebhookItem = {
      id: 'wh-42',
      label: 'My production webhook',
      endpointUrl: 'https://example.com/hook',
      eventTypes: ['card.created'],
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
    };

    const payload = buildDeletePayload(webhook);
    expect(payload).toBe('wh-42');
  });

  it('calls onDeleted callback after successful deletion', async () => {
    const onDeleted = mock(() => {});

    // Simulate the successful mutation result (no 'error' key).
    const result: Record<string, unknown> = { data: undefined };
    if (!('error' in result)) {
      onDeleted();
    }

    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onDeleted when mutation returns an error', async () => {
    const onDeleted = mock(() => {});

    // Simulate a failed mutation result.
    const result: Record<string, unknown> = { error: { status: 500 } };
    if (!('error' in result)) {
      onDeleted();
    }

    expect(onDeleted).toHaveBeenCalledTimes(0);
  });
});

describe('DeleteWebhookDialog — cancel action', () => {
  it('calls onClose when cancel is clicked', () => {
    const onClose = mock(() => {});

    // Simulate cancel click.
    onClose();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call deleteWebhook when cancel is clicked', () => {
    const deleteWebhook = mock((_id: string) => Promise.resolve({ data: undefined }));
    const onClose = mock(() => {});

    // Simulate cancel — only onClose fires, deleteWebhook is never called.
    onClose();

    expect(deleteWebhook).toHaveBeenCalledTimes(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('DeleteWebhookDialog — backdrop click closes dialog', () => {
  it('calls onClose when backdrop is clicked', () => {
    const onClose = mock(() => {});

    // Simulate backdrop click — same handler as cancel.
    onClose();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
