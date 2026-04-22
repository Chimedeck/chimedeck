import { describe, expect, it } from 'bun:test';

import { canManageWebhook } from '../../../server/extensions/webhooks/api/mods/webhookPermissions';

describe('canManageWebhook', () => {
  it('allows the creator of the webhook', () => {
    expect(
      canManageWebhook({
        webhookCreatedBy: 'user-1',
        currentUserId: 'user-1',
      }),
    ).toBe(true);
  });

  it('rejects non-owners', () => {
    expect(
      canManageWebhook({
        webhookCreatedBy: 'user-1',
        currentUserId: 'user-2',
      }),
    ).toBe(false);
  });
});
