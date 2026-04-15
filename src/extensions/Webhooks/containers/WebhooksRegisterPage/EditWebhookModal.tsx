// EditWebhookModal — pre-populated form to update an existing webhook, including active toggle.
// Shares validation rules with RegisterWebhookModal: https:// prefix required, at least one event type.
import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useUpdateWebhookMutation, useListEventTypesQuery } from '../../webhooks.slice';
import type { WebhookItem } from '../../webhooks.slice';
import Button from '~/common/components/Button';
import Input from '~/common/components/Input';
import IconButton from '~/common/components/IconButton';
import translations from '../../translations/en.json';

// [why] Must stay in sync with RegisterWebhookModal — both UIs expose the same canonical event set.
const EVENT_GROUPS: { label: string; events: string[] }[] = [
  {
    label: 'Card lifecycle',
    events: ['card.created', 'card.updated', 'card.deleted', 'card.archived'],
  },
  {
    label: 'Card content',
    events: ['card.description_edited', 'card.attachment_added', 'card.commented'],
  },
  {
    label: 'Card people',
    events: ['card.member_assigned', 'card.member_removed'],
  },
  {
    label: 'Navigation',
    events: ['card.moved'],
  },
  {
    label: 'Mentions',
    events: ['mention'],
  },
  {
    label: 'Board',
    events: ['board.created', 'board.member_added'],
  },
];

interface Props {
  webhook: WebhookItem;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function EditWebhookModal({ webhook, onClose, onUpdated }: Props) {
  const [label, setLabel] = useState(webhook.label);
  const [url, setUrl] = useState(webhook.endpointUrl);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set(webhook.eventTypes));
  const [isActive, setIsActive] = useState(webhook.isActive);
  const [urlError, setUrlError] = useState('');
  const [eventsError, setEventsError] = useState('');

  const { data: serverEventTypes } = useListEventTypesQuery();
  const [updateWebhook, { isLoading }] = useUpdateWebhookMutation();

  function toggleEvent(event: string) {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) {
        next.delete(event);
      } else {
        next.add(event);
      }
      return next;
    });
    setEventsError('');
  }

  function selectAllInGroup(events: string[]) {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      events.forEach((e) => next.add(e));
      return next;
    });
    setEventsError('');
  }

  function clearAllInGroup(events: string[]) {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      events.forEach((e) => next.delete(e));
      return next;
    });
  }

  function isGroupAllSelected(events: string[]) {
    return events.every((e) => selectedEvents.has(e));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let valid = true;

    if (!url.startsWith('https://')) {
      setUrlError(translations['RegisterWebhookModal.urlError']);
      valid = false;
    } else {
      setUrlError('');
    }

    if (selectedEvents.size === 0) {
      setEventsError(translations['RegisterWebhookModal.eventsError']);
      valid = false;
    } else {
      setEventsError('');
    }

    if (!valid) return;

    const result = await updateWebhook({
      id: webhook.id,
      label,
      endpointUrl: url,
      eventTypes: Array.from(selectedEvents),
      isActive,
    });

    if ('data' in result) {
      onUpdated?.();
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-webhook-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg rounded-lg bg-bg-surface shadow-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 id="edit-webhook-title" className="text-base font-semibold text-text-primary">
            {translations['EditWebhookModal.title']}
          </h3>
          <IconButton
            aria-label="Close modal"
            icon={<XMarkIcon className="h-4 w-4" />}
            variant="ghost"
            onClick={onClose}
          />
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-6 py-5">
            <Input
              label={translations['RegisterWebhookModal.labelField']}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={100}
              required
              placeholder="e.g. My production server"
              data-testid="webhook-label-input"
            />

            <Input
              label={translations['RegisterWebhookModal.urlField']}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (urlError && e.target.value.startsWith('https://')) setUrlError('');
              }}
              error={urlError}
              required
              placeholder="https://example.com/webhook"
              type="url"
              data-testid="webhook-url-input"
            />

            {/* Active / Inactive toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive((prev) => !prev)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  isActive ? 'bg-primary' : 'bg-border'
                }`}
                data-testid="active-toggle"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                    isActive ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm text-text-primary">
                {translations['EditWebhookModal.activeLabel']}
              </span>
            </div>

            {/* Event type checklist */}
            <div>
              <p className="mb-2 text-sm font-medium text-muted">
                {translations['RegisterWebhookModal.eventsField']}
              </p>

              <div
                className="max-h-60 overflow-y-auto rounded-md border border-border bg-bg-overlay p-3 space-y-4"
                data-testid="event-types-list"
              >
                {EVENT_GROUPS.map((group) => {
                  const available = serverEventTypes
                    ? group.events.filter((e) => serverEventTypes.includes(e))
                    : group.events;

                  const allSelected = isGroupAllSelected(available);

                  return (
                    <div key={group.label}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-subtle">
                          {group.label}
                        </span>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() =>
                            allSelected
                              ? clearAllInGroup(available)
                              : selectAllInGroup(available)
                          }
                          data-testid={`group-toggle-${group.label.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          {allSelected
                            ? translations['RegisterWebhookModal.clearAll']
                            : translations['RegisterWebhookModal.selectAll']}
                        </button>
                      </div>
                      <div className="space-y-1">
                        {available.map((event) => (
                          <label
                            key={event}
                            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-bg-surface"
                          >
                            <input
                              type="checkbox"
                              checked={selectedEvents.has(event)}
                              onChange={() => toggleEvent(event)}
                              className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                              data-testid={`event-checkbox-${event}`}
                            />
                            <span className="font-mono text-xs text-text-primary">{event}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {eventsError && (
                <p className="mt-1 text-xs text-danger" data-testid="events-error">
                  {eventsError}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              {translations['EditWebhookModal.cancel']}
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {translations['EditWebhookModal.submit']}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
