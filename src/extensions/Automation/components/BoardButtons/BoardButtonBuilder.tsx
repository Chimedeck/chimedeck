// BoardButtonBuilder — modal for creating / editing a BOARD_BUTTON automation.
// Fields: name, icon picker, scope selector (board / list / filter), action list.
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

type ScopeType = 'board' | 'list' | 'filter';

interface ScopeConfig {
  targetScope: ScopeType;
  listId?: string;
  labelIds?: string[];
  memberIds?: string[];
}

interface Props {
  boardId: string;
  /** When provided, the builder operates in edit mode. */
  existing?: Automation;
  onSave: (automation: Automation) => void;
  onClose: () => void;
}

const DEFAULT_BOARD_ICON: ButtonIconName = 'BoltIcon';

const BoardButtonBuilder: FC<Props> = ({ boardId, existing, onSave, onClose }) => {
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState<ButtonIconName>(
    (existing?.icon as ButtonIconName | null) ?? DEFAULT_BOARD_ICON,
  );
  const [scope, setScope] = useState<ScopeType>(() => {
    if (!existing) return 'board';
    try {
      const cfg = existing as unknown as { config?: { targetScope?: ScopeType } };
      return cfg.config?.targetScope ?? 'board';
    } catch {
      return 'board';
    }
  });
  const [listId, setListId] = useState('');
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

  const buildScopeConfig = (): ScopeConfig => {
    if (scope === 'list') {
      const trimmedListId = listId.trim();
      return trimmedListId ? { targetScope: 'list', listId: trimmedListId } : { targetScope: 'list' };
    }
    return { targetScope: scope };
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      const actionPayload = actions.map((a, i) => ({
        actionType: a.actionType,
        position: i,
        config: { ...a.config, ...buildScopeConfig() },
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
            automationType: 'BOARD_BUTTON',
            icon,
            trigger: null as any, // BOARD_BUTTON has no trigger
            actions: actionPayload,
          },
        });
        onSave(res.data);
      }
    } catch {
      setError(translations['automation.boardButtonBuilder.error.saveFailed']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label={existing ? translations['automation.boardButtonBuilder.ariaEdit'] : translations['automation.boardButtonBuilder.ariaCreate']}
    >
      <div className="bg-bg-base border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col gap-5 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <BoltIcon className="h-5 w-5 text-blue-400 flex-shrink-0" aria-hidden="true" />
          <h2 className="flex-1 text-base font-semibold text-base">
            {existing ? translations['automation.boardButtonBuilder.titleEdit'] : translations['automation.boardButtonBuilder.titleCreate']}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={onClose}
            aria-label={translations['automation.boardButtonBuilder.close']}
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="board-btn-name" className="text-xs font-medium text-muted uppercase tracking-wide">
            {translations['automation.boardButtonBuilder.nameLabel']}
          </label>
          <input
            id="board-btn-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={translations['automation.boardButtonBuilder.namePlaceholder']}
            maxLength={80}
            className="rounded-md bg-bg-surface border border-border px-3 py-2 text-sm text-base placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Icon picker */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">{translations['automation.boardButtonBuilder.iconLabel']}</span>
          <IconPicker value={icon} onChange={setIcon} />
        </div>

        {/* Scope selector */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted uppercase tracking-wide">{translations['automation.boardButtonBuilder.scopeLabel']}</span>
          <div className="flex gap-2">
            {(['board', 'list', 'filter'] as ScopeType[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={[
                  'flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors border',
                  scope === s
                    ? 'bg-primary border-primary text-white' // [theme-exception] text-white on active primary button
                    : 'bg-bg-surface border-border text-muted hover:text-subtle hover:border-border',
                ].join(' ')}
              >
                {s}
              </button>
            ))}
          </div>

          {scope === 'list' && (
            <div className="flex flex-col gap-1">
              <label htmlFor="scope-list-id" className="text-xs text-muted">
                {translations['automation.boardButtonBuilder.listIdLabel']}
              </label>
              <input
                id="scope-list-id"
                type="text"
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                placeholder={translations['automation.boardButtonBuilder.listIdPlaceholder']}
                className="rounded-md bg-bg-surface border border-border px-3 py-2 text-sm text-base placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {scope === 'filter' && (
            <p className="text-xs text-muted">
              {translations['automation.boardButtonBuilder.filterHint']}
            </p>
          )}

          {scope === 'board' && (
            <p className="text-xs text-muted">{translations['automation.boardButtonBuilder.boardScopeHint']}</p>
          )}
        </div>

        {/* Action list */}
        <div className="flex flex-col gap-1.5">
          <ActionList actions={actions} onChange={setActions} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
          >
            {translations['automation.boardButtonBuilder.cancel']}
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={!isValid || saving}
            onClick={handleSave}
          >
            {saving ? translations['automation.boardButtonBuilder.saving'] : existing ? translations['automation.boardButtonBuilder.saveChanges'] : translations['automation.boardButtonBuilder.create']}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BoardButtonBuilder;
