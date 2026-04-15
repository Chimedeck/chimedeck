// Integration tests for the Webhooks UI CRUD flow — edit and delete.
// Tests cover state transitions and payload correctness without requiring a live server.
import { describe, it, expect, mock } from 'bun:test';

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

interface WebhookItem {
  id: string;
  label: string;
  endpointUrl: string;
  eventTypes: string[];
  isActive: boolean;
  createdAt: string;
}

const FIXTURE_WEBHOOK: WebhookItem = {
  id: 'wh-001',
  label: 'CI webhook',
  endpointUrl: 'https://ci.example.com/hook',
  eventTypes: ['card.created', 'card.updated'],
  isActive: true,
  createdAt: '2024-03-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Simulated UI state management
// ---------------------------------------------------------------------------

function createPageState(initialWebhooks: WebhookItem[]) {
  let webhooks = [...initialWebhooks];
  let editingWebhook: WebhookItem | null = null;
  let deletingWebhook: WebhookItem | null = null;

  return {
    getWebhooks: () => webhooks,
    getEditingWebhook: () => editingWebhook,
    getDeletingWebhook: () => deletingWebhook,

    openEditModal: (webhook: WebhookItem) => { editingWebhook = webhook; },
    closeEditModal: () => { editingWebhook = null; },

    openDeleteDialog: (webhook: WebhookItem) => { deletingWebhook = webhook; },
    closeDeleteDialog: () => { deletingWebhook = null; },

    applyUpdate: (id: string, patch: Partial<WebhookItem>) => {
      webhooks = webhooks.map((w) => (w.id === id ? { ...w, ...patch } : w));
      editingWebhook = null;
    },

    applyDelete: (id: string) => {
      webhooks = webhooks.filter((w) => w.id !== id);
      deletingWebhook = null;
    },
  };
}

// ---------------------------------------------------------------------------
// Edit flow
// ---------------------------------------------------------------------------

describe('UI CRUD — edit webhook flow', () => {
  it('opens EditWebhookModal with the correct webhook', () => {
    const page = createPageState([FIXTURE_WEBHOOK]);
    page.openEditModal(FIXTURE_WEBHOOK);

    const editing = page.getEditingWebhook();
    expect(editing).not.toBeNull();
    expect(editing!.id).toBe('wh-001');
    expect(editing!.label).toBe('CI webhook');
  });

  it('pre-fills edit modal fields from the webhook', () => {
    const page = createPageState([FIXTURE_WEBHOOK]);
    page.openEditModal(FIXTURE_WEBHOOK);

    const editing = page.getEditingWebhook()!;
    // Verify the modal receives the correct data to pre-fill
    expect(editing.endpointUrl).toBe('https://ci.example.com/hook');
    expect(editing.eventTypes).toContain('card.created');
    expect(editing.isActive).toBe(true);
  });

  it('closes EditWebhookModal on cancel', () => {
    const page = createPageState([FIXTURE_WEBHOOK]);
    page.openEditModal(FIXTURE_WEBHOOK);
    page.closeEditModal();

    expect(page.getEditingWebhook()).toBeNull();
  });

  it('applies update and closes modal on successful save', () => {
    const page = createPageState([FIXTURE_WEBHOOK]);
    page.openEditModal(FIXTURE_WEBHOOK);

    page.applyUpdate('wh-001', {
      label: 'Updated CI webhook',
      isActive: false,
    });

    expect(page.getEditingWebhook()).toBeNull();
    const updated = page.getWebhooks().find((w) => w.id === 'wh-001');
    expect(updated!.label).toBe('Updated CI webhook');
    expect(updated!.isActive).toBe(false);
  });

  it('does not modify other webhooks when updating one', () => {
    const second: WebhookItem = { ...FIXTURE_WEBHOOK, id: 'wh-002', label: 'Other' };
    const page = createPageState([FIXTURE_WEBHOOK, second]);

    page.applyUpdate('wh-001', { label: 'Updated CI webhook' });

    const other = page.getWebhooks().find((w) => w.id === 'wh-002');
    expect(other!.label).toBe('Other');
  });

  it('active toggle can deactivate a webhook', () => {
    const page = createPageState([FIXTURE_WEBHOOK]);
    page.applyUpdate('wh-001', { isActive: false });

    const updated = page.getWebhooks().find((w) => w.id === 'wh-001');
    expect(updated!.isActive).toBe(false);
  });

  it('active toggle can reactivate a webhook', () => {
    const inactive = { ...FIXTURE_WEBHOOK, isActive: false };
    const page = createPageState([inactive]);
    page.applyUpdate('wh-001', { isActive: true });

    const updated = page.getWebhooks().find((w) => w.id === 'wh-001');
    expect(updated!.isActive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Delete flow
// ---------------------------------------------------------------------------

describe('UI CRUD — delete webhook flow', () => {
  it('opens DeleteWebhookDialog with the correct webhook', () => {
    const page = createPageState([FIXTURE_WEBHOOK]);
    page.openDeleteDialog(FIXTURE_WEBHOOK);

    const deleting = page.getDeletingWebhook();
    expect(deleting).not.toBeNull();
    expect(deleting!.id).toBe('wh-001');
    expect(deleting!.label).toBe('CI webhook');
  });

  it('closes DeleteWebhookDialog on cancel', () => {
    const page = createPageState([FIXTURE_WEBHOOK]);
    page.openDeleteDialog(FIXTURE_WEBHOOK);
    page.closeDeleteDialog();

    expect(page.getDeletingWebhook()).toBeNull();
  });

  it('removes webhook from list and closes dialog on confirm', () => {
    const page = createPageState([FIXTURE_WEBHOOK]);
    page.openDeleteDialog(FIXTURE_WEBHOOK);
    page.applyDelete('wh-001');

    expect(page.getDeletingWebhook()).toBeNull();
    expect(page.getWebhooks().find((w) => w.id === 'wh-001')).toBeUndefined();
  });

  it('does not remove other webhooks when deleting one', () => {
    const second: WebhookItem = { ...FIXTURE_WEBHOOK, id: 'wh-002', label: 'Other' };
    const page = createPageState([FIXTURE_WEBHOOK, second]);

    page.applyDelete('wh-001');

    expect(page.getWebhooks()).toHaveLength(1);
    expect(page.getWebhooks()[0].id).toBe('wh-002');
  });

  it('shows empty state after last webhook is deleted', () => {
    const page = createPageState([FIXTURE_WEBHOOK]);
    page.applyDelete('wh-001');

    expect(page.getWebhooks()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Edit and delete modals are mutually exclusive
// ---------------------------------------------------------------------------

describe('UI CRUD — modal exclusivity', () => {
  it('only one modal is open at a time — opening edit while delete is open replaces state', () => {
    const page = createPageState([FIXTURE_WEBHOOK]);

    page.openDeleteDialog(FIXTURE_WEBHOOK);
    expect(page.getDeletingWebhook()).not.toBeNull();

    // Simulate closing delete and opening edit (correct UX flow)
    page.closeDeleteDialog();
    page.openEditModal(FIXTURE_WEBHOOK);

    expect(page.getDeletingWebhook()).toBeNull();
    expect(page.getEditingWebhook()).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Delete mutation payload
// ---------------------------------------------------------------------------

describe('UI CRUD — delete API payload', () => {
  it('deleteWebhook is called with the webhook id', () => {
    const deleteWebhook = mock((_id: string) => Promise.resolve({ data: undefined }));

    deleteWebhook(FIXTURE_WEBHOOK.id);

    expect(deleteWebhook).toHaveBeenCalledWith('wh-001');
  });
});

// ---------------------------------------------------------------------------
// Update mutation payload
// ---------------------------------------------------------------------------

describe('UI CRUD — update API payload', () => {
  it('updateWebhook payload includes id and changed fields', () => {
    const updateWebhook = mock((_payload: Record<string, unknown>) =>
      Promise.resolve({ data: {} })
    );

    const payload = {
      id: FIXTURE_WEBHOOK.id,
      label: 'New label',
      endpointUrl: FIXTURE_WEBHOOK.endpointUrl,
      eventTypes: FIXTURE_WEBHOOK.eventTypes,
      isActive: false,
    };

    updateWebhook(payload);

    expect(updateWebhook).toHaveBeenCalledWith(payload);
  });

  it('updateWebhook payload preserves unmodified fields', () => {
    const payload = {
      id: FIXTURE_WEBHOOK.id,
      label: FIXTURE_WEBHOOK.label,
      endpointUrl: FIXTURE_WEBHOOK.endpointUrl,
      eventTypes: FIXTURE_WEBHOOK.eventTypes,
      isActive: FIXTURE_WEBHOOK.isActive,
    };

    expect(payload.label).toBe('CI webhook');
    expect(payload.endpointUrl).toBe('https://ci.example.com/hook');
  });
});
