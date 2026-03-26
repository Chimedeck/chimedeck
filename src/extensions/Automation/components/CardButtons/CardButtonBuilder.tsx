// CardButtonBuilder — modal for creating / editing a CARD_BUTTON automation.
// Steps: name input → icon picker → action list (reuses ActionList from RuleBuilder).
import { useState } from 'react';
import { XMarkIcon, BoltIcon } from '@heroicons/react/24/outline';
import type { FC } from 'react';
import Button from '../../../../common/components/Button';
import IconPicker, { BUTTON_ICONS, type ButtonIconName } from '../shared/IconPicker';
import ActionList from '../AutomationPanel/RuleBuilder/ActionList';
import type { ActionItemData } from '../AutomationPanel/RuleBuilder/ActionItem';
import { createAutomation, updateAutomation } from '../../api';
import type { Automation } from '../../types';
import translations from '../../translations/en.json';

interface Props {
  boardId: string;
  /** When provided, the builder operates in edit mode. */
  existing?: Automation;
  onSave: (automation: Automation) => void;
  onClose: () => void;
}

const DEFAULT_ICON: ButtonIconName = 'PlayIcon';

const CardButtonBuilder: FC<Props> = ({ boardId, existing, onSave, onClose }) => {
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState<ButtonIconName>(
    (existing?.icon as ButtonIconName | null) ?? DEFAULT_ICON,
  );
  const [actions, setActions] = useState<ActionItemData[]>(
    existing?.actions.map((a) => ({
      id: a.id,
      actionType: a.actionType,
      label: a.actionType,
      config: a.config as Record<string, unknown>,
    })) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = name.trim().length > 0 && actions.length > 0;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      const actionPayload = actions.map((a, i) => ({
        actionType: a.actionType,
        position: i,
        config: a.config,
      }));

      if (existing) {
        const res = await updateAutomation({
          boardId,
          automationId: existing.id,
          patch: {
            name: name.trim(),
            icon,
            actions: actionPayload,
          },
        });
        onSave(res.data);
      } else {
        const res = await createAutomation({
          boardId,
          payload: {
            name: name.trim(),
            automationType: 'CARD_BUTTON',
            icon,
            trigger: null as any, // CARD_BUTTON has no trigger
            actions: actionPayload,
          },
        });
        onSave(res.data);
      }
    } catch {
      setError(translations['automation.cardButtonBuilder.error.saveFailed']);
    } finally {
      setSaving(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label={existing ? translations['automation.cardButtonBuilder.ariaEdit'] : translations['automation.cardButtonBuilder.ariaCreate']}
    >
      <div className="bg-bg-base border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col gap-5 p-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <BoltIcon className="h-5 w-5 text-blue-400 flex-shrink-0" aria-hidden="true" />
          <h2 className="flex-1 text-base font-semibold text-base">
            {existing ? translations['automation.cardButtonBuilder.titleEdit'] : translations['automation.cardButtonBuilder.titleCreate']}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={onClose}
            aria-label={translations['automation.cardButtonBuilder.close']}
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="btn-name" className="text-xs font-medium text-muted uppercase tracking-wide">
            {translations['automation.cardButtonBuilder.nameLabel']}
          </label>
          <input
            id="btn-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={translations['automation.cardButtonBuilder.namePlaceholder']}
            maxLength={80}
            className="rounded-md bg-bg-surface border border-border px-3 py-2 text-sm text-base placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Icon picker */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">{translations['automation.cardButtonBuilder.iconLabel']}</span>
          <IconPicker value={icon} onChange={setIcon} />
        </div>

        {/* Action list */}
        <div className="flex flex-col gap-1.5">
          <ActionList actions={actions} onChange={setActions} />
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
          >
            {translations['automation.cardButtonBuilder.cancel']}
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={!isValid || saving}
            onClick={handleSave}
          >
            {saving ? translations['automation.cardButtonBuilder.saving'] : existing ? translations['automation.cardButtonBuilder.saveChanges'] : translations['automation.cardButtonBuilder.create']}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CardButtonBuilder;
