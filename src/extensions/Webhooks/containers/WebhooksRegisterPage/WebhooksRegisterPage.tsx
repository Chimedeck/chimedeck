// WebhooksRegisterPage — lists registered webhooks in a table with empty state handling.
import { useState } from 'react';
import {
  useListWebhooksQuery,
  type WebhookItem,
  type CreateWebhookResponse,
} from '../../webhooks.slice';
import translations from '../../translations/en.json';
import Spinner from '~/common/components/Spinner';
import Button from '~/common/components/Button';
import RegisterWebhookModal from './RegisterWebhookModal';
import WebhookCreatedModal from './WebhookCreatedModal';
import EditWebhookModal from './EditWebhookModal';
import DeleteWebhookDialog from './DeleteWebhookDialog';
import SignatureVerificationSnippet from './SignatureVerificationSnippet';

function useWorkspaceId(): string {
  // [why] Workspace ID is read from URL path so the page stays shareable.
  const match = window.location.pathname.match(/workspaces\/([^/]+)/);
  return match ? match[1] ?? '' : '';
}

export default function WebhooksRegisterPage() {
  const workspaceId = useWorkspaceId();
  const { data: webhooks, isLoading } = useListWebhooksQuery(workspaceId, {
    skip: !workspaceId,
  });

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [createdWebhook, setCreatedWebhook] = useState<CreateWebhookResponse | null>(null);
  const [editingWebhook, setEditingWebhook] = useState<WebhookItem | null>(null);
  const [deletingWebhook, setDeletingWebhook] = useState<WebhookItem | null>(null);

  function handleCreated(response: CreateWebhookResponse) {
    setCreatedWebhook(response);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base">
            {translations['WebhooksRegisterPage.title']}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {translations['WebhooksRegisterPage.description']}
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowRegisterModal(true)}>
          {translations['WebhooksRegisterPage.registerButton']}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" className="text-blue-500" />
        </div>
      ) : !webhooks || webhooks.length === 0 ? (
        <p className="text-sm text-muted" data-testid="webhooks-empty-state">
          {translations['WebhooksRegisterPage.emptyState']}
        </p>
      ) : (
        <WebhooksTable
          webhooks={webhooks}
          onEdit={setEditingWebhook}
          onDelete={setDeletingWebhook}
        />
      )}

      {showRegisterModal && (
        <RegisterWebhookModal
          workspaceId={workspaceId}
          onClose={() => setShowRegisterModal(false)}
          onCreated={handleCreated}
        />
      )}

      {createdWebhook && (
        <WebhookCreatedModal
          signingSecret={createdWebhook.data.signingSecret}
          onClose={() => setCreatedWebhook(null)}
        />
      )}

      {editingWebhook && (
        <EditWebhookModal
          webhook={editingWebhook}
          onClose={() => setEditingWebhook(null)}
        />
      )}

      {deletingWebhook && (
        <DeleteWebhookDialog
          webhook={deletingWebhook}
          onClose={() => setDeletingWebhook(null)}
        />
      )}

      <SignatureVerificationSnippet />
    </div>
  );
}

function WebhooksTable({
  webhooks,
  onEdit,
  onDelete,
}: {
  webhooks: WebhookItem[];
  onEdit: (webhook: WebhookItem) => void;
  onDelete: (webhook: WebhookItem) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm" data-testid="webhooks-table">
        <thead>
          <tr className="border-b border-border bg-bg-surface/60">
            <th className="px-4 py-3 text-left font-medium text-muted">
              {translations['WebhooksRegisterPage.tableLabelCol']}
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted">
              {translations['WebhooksRegisterPage.tableUrlCol']}
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted">
              {translations['WebhooksRegisterPage.tableEventsCol']}
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted">
              {translations['WebhooksRegisterPage.tableStatusCol']}
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {webhooks.map((webhook) => (
            <WebhookRow
              key={webhook.id}
              webhook={webhook}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WebhookRow({
  webhook,
  onEdit,
  onDelete,
}: {
  webhook: WebhookItem;
  onEdit: (webhook: WebhookItem) => void;
  onDelete: (webhook: WebhookItem) => void;
}) {
  return (
    <tr className="border-b border-border/50 hover:bg-bg-surface/30">
      <td className="px-4 py-3 font-medium text-base">{webhook.label}</td>
      <td className="max-w-[200px] truncate px-4 py-3 font-mono text-subtle">
        {webhook.endpointUrl}
      </td>
      <td className="px-4 py-3 text-muted">{webhook.eventTypes.length}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            webhook.isActive
              ? 'bg-green-900/30 text-green-400'
              : 'bg-bg-overlay text-muted'
          }`}
        >
          {webhook.isActive
            ? translations['WebhooksRegisterPage.statusActive']
            : translations['WebhooksRegisterPage.statusInactive']}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <Button variant="ghost" size="sm" onClick={() => onEdit(webhook)} data-testid={`edit-webhook-${webhook.id}`}>
          {translations['WebhooksRegisterPage.editButton']}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(webhook)}
          className="!text-danger hover:!bg-red-900/30 hover:!text-red-300"
          data-testid={`delete-webhook-${webhook.id}`}
        >
          {translations['WebhooksRegisterPage.deleteButton']}
        </Button>
      </td>
    </tr>
  );
}
