// DeleteWebhookDialog — confirmation dialog before permanently removing a webhook.
// Shows the webhook label so the user can confirm they are deleting the right endpoint.
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useDeleteWebhookMutation } from '../../webhooks.slice';
import type { WebhookItem } from '../../webhooks.slice';
import Button from '~/common/components/Button';
import IconButton from '~/common/components/IconButton';
import translations from '../../translations/en.json';

interface Props {
  webhook: WebhookItem;
  onClose: () => void;
  onDeleted?: () => void;
}

export default function DeleteWebhookDialog({ webhook, onClose, onDeleted }: Props) {
  const [deleteWebhook, { isLoading }] = useDeleteWebhookMutation();

  async function handleConfirm() {
    const result = await deleteWebhook(webhook.id);
    // [why] RTK Query mutation returns { data } on success or { error } on failure.
    if (!('error' in result)) {
      onDeleted?.();
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-webhook-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-sm rounded-lg bg-bg-surface shadow-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 id="delete-webhook-title" className="text-base font-semibold text-text-primary">
            {translations['DeleteWebhookDialog.title']}
          </h3>
          <IconButton
            aria-label="Close dialog"
            icon={<XMarkIcon className="h-4 w-4" />}
            variant="ghost"
            onClick={onClose}
          />
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-text-primary" data-testid="delete-dialog-body">
            {translations['DeleteWebhookDialog.body']}{' '}
            <span className="font-semibold" data-testid="delete-webhook-label">
              {webhook.label}
            </span>
            {'?'}
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose} data-testid="cancel-button">
            {translations['DeleteWebhookDialog.cancel']}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={isLoading}
            onClick={handleConfirm}
            data-testid="confirm-delete-button"
          >
            {translations['DeleteWebhookDialog.confirm']}
          </Button>
        </div>
      </div>
    </div>
  );
}
