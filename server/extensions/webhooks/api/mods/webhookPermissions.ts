type CanManageWebhookParams = {
  webhookCreatedBy: string;
  currentUserId: string;
};

/**
 * Global webhooks are no longer workspace-scoped.
 * Only the webhook creator can update/delete their webhook.
 */
export function canManageWebhook({
  webhookCreatedBy,
  currentUserId,
}: CanManageWebhookParams): boolean {
  return webhookCreatedBy === currentUserId;
}
