// BoardButtonBuilder — modal for creating / editing a BOARD_BUTTON automation.
// Fields: name, icon picker, scope selector (board / list / filter), action list.
import { useState } from 'react';
import { XMarkIcon, BoltIcon } from '@heroicons/react/24/outline';
import type { FC } from 'react';
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
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md flex flex-col gap-5 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <BoltIcon className="h-5 w-5 text-blue-400 flex-shrink-0" aria-hidden="true" />
          <h2 className="flex-1 text-base font-semibold text-slate-100">
            {existing ? translations['automation.boardButtonBuilder.titleEdit'] : translations['automation.boardButtonBuilder.titleCreate']}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            aria-label={translations['automation.boardButtonBuilder.close']}
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="board-btn-name" className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            {translations['automation.boardButtonBuilder.nameLabel']}
          </label>
          <input
            id="board-btn-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={translations['automation.boardButtonBuilder.namePlaceholder']}
            maxLength={80}
            className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Icon picker */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{translations['automation.boardButtonBuilder.iconLabel']}</span>
          <IconPicker value={icon} onChange={setIcon} />
        </div>

        {/* Scope selector */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{translations['automation.boardButtonBuilder.scopeLabel']}</span>
          <div className="flex gap-2">
            {(['board', 'list', 'filter'] as ScopeType[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={[
                  'flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors border',
                  scope === s
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600',
                ].join(' ')}
              >
                {s}
              </button>
            ))}
          </div>

          {scope === 'list' && (
            <div className="flex flex-col gap-1">
              <label htmlFor="scope-list-id" className="text-xs text-slate-500">
                {translations['automation.boardButtonBuilder.listIdLabel']}
              </label>
              <input
                id="scope-list-id"
                type="text"
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                placeholder={translations['automation.boardButtonBuilder.listIdPlaceholder']}
                className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {scope === 'filter' && (
            <p className="text-xs text-slate-500">
              {translations['automation.boardButtonBuilder.filterHint']}
            </p>
          )}

          {scope === 'board' && (
            <p className="text-xs text-slate-500">{translations['automation.boardButtonBuilder.boardScopeHint']}</p>
          )}
        </div>

        {/* Action list */}
        <div className="flex flex-col gap-1.5">
          <ActionList actions={actions} onChange={setActions} />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            {translations['automation.boardButtonBuilder.cancel']}
          </button>
          <button
            type="button"
            disabled={!isValid || saving}
            onClick={handleSave}
            className="rounded-md px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? translations['automation.boardButtonBuilder.saving'] : existing ? translations['automation.boardButtonBuilder.saveChanges'] : translations['automation.boardButtonBuilder.create']}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BoardButtonBuilder;
