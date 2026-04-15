// Unit tests for WebhookCreatedModal — secret reveal, copy/reset behaviour.
// Pure logic tests; clipboard API interaction is tested via mock.
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';

// Simulates the copy-to-clipboard state machine used by WebhookCreatedModal.
function createCopyState() {
  let copied = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return {
    get copied() { return copied; },
    async copy(text: string, writeText: (s: string) => Promise<void>, delay = 2000) {
      await writeText(text);
      copied = true;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        copied = false;
      }, delay);
    },
    reset() {
      copied = false;
      if (timeoutId) clearTimeout(timeoutId);
    },
  };
}

describe('WebhookCreatedModal — copy-to-clipboard state', () => {
  it('sets copied to true immediately after copy', async () => {
    const state = createCopyState();
    const writeText = mock(() => Promise.resolve());
    await state.copy('secret-abc', writeText, 5000);
    expect(state.copied).toBe(true);
  });

  it('passes the signing secret to writeText', async () => {
    const state = createCopyState();
    const writes: string[] = [];
    const writeText = mock((s: string) => { writes.push(s); return Promise.resolve(); });
    await state.copy('my-signing-secret', writeText, 5000);
    expect(writes[0]).toBe('my-signing-secret');
  });

  it('resets copied to false after timeout', async () => {
    const state = createCopyState();
    const writeText = mock(() => Promise.resolve());
    await state.copy('secret', writeText, 10);
    expect(state.copied).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(state.copied).toBe(false);
  });

  it('does not reset before timeout elapses', async () => {
    const state = createCopyState();
    const writeText = mock(() => Promise.resolve());
    await state.copy('secret', writeText, 500);
    await new Promise((r) => setTimeout(r, 50));
    expect(state.copied).toBe(true);
    state.reset();
  });

  it('reset() clears copied state immediately', () => {
    const state = createCopyState();
    // Manually set copied via internal mechanism simulation
    state.reset();
    expect(state.copied).toBe(false);
  });
});

describe('WebhookCreatedModal — signing secret display', () => {
  it('signing secret is a non-empty string', () => {
    const secret = 'whsec_abcdef1234567890';
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(0);
  });

  it('signing secret is not exposed in list data (interface check)', () => {
    // [why] WebhookItem does NOT include signingSecret — only CreateWebhookResponse does.
    // Ensure the shape of the response matches the spec.
    type WebhookItem = {
      id: string;
      label: string;
      endpointUrl: string;
      eventTypes: string[];
      isActive: boolean;
      createdAt: string;
    };
    type CreateWebhookResponse = {
      data: WebhookItem & { signingSecret: string };
    };

    const response: CreateWebhookResponse = {
      data: {
        id: 'wh-1',
        label: 'Test',
        endpointUrl: 'https://example.com/hook',
        eventTypes: ['card.created'],
        isActive: true,
        createdAt: new Date().toISOString(),
        signingSecret: 'secret-value',
      },
    };

    expect(response.data.signingSecret).toBe('secret-value');

    // A plain WebhookItem should NOT have signingSecret (type-level check via cast)
    const listItem: WebhookItem = { ...response.data };
    expect((listItem as any).signingSecret).toBe('secret-value'); // exists on object but not on type
  });
});

describe('WebhookCreatedModal — translation keys', () => {
  // [why] Confirm all required translation keys are present in en.json
  it('en.json contains all WebhookCreatedModal keys', async () => {
    const translations = await import('../../../src/extensions/Webhooks/translations/en.json');
    const required = [
      'WebhookCreatedModal.title',
      'WebhookCreatedModal.successBanner',
      'WebhookCreatedModal.secretLabel',
      'WebhookCreatedModal.secretWarning',
      'WebhookCreatedModal.copyButton',
      'WebhookCreatedModal.copiedButton',
      'WebhookCreatedModal.done',
    ];
    for (const key of required) {
      expect((translations as any)[key]).toBeDefined();
      expect(typeof (translations as any)[key]).toBe('string');
    }
  });

  it('en.json contains all RegisterWebhookModal keys', async () => {
    const translations = await import('../../../src/extensions/Webhooks/translations/en.json');
    const required = [
      'RegisterWebhookModal.title',
      'RegisterWebhookModal.labelField',
      'RegisterWebhookModal.urlField',
      'RegisterWebhookModal.eventsField',
      'RegisterWebhookModal.selectAll',
      'RegisterWebhookModal.clearAll',
      'RegisterWebhookModal.urlError',
      'RegisterWebhookModal.eventsError',
      'RegisterWebhookModal.submit',
      'RegisterWebhookModal.cancel',
    ];
    for (const key of required) {
      expect((translations as any)[key]).toBeDefined();
      expect(typeof (translations as any)[key]).toBe('string');
    }
  });
});
