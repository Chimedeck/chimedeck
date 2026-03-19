// RuleBuilder — multi-step guided builder for RULE-type automations.
// Steps: 1. Trigger picker + config  2. Action list  3. Name + Save
// Supports both "create" (no initialAutomation) and "edit" (with initialAutomation) modes.
import { useState, useEffect } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import type { Automation, TriggerType } from '../../../types';
import { createAutomation, updateAutomation, getTriggerTypes } from '../../../api';
import TriggerPicker from './TriggerPicker';
import TriggerConfig from './TriggerConfig';
import ActionList from './ActionList';
import { hasConfigFields } from './configFieldRenderer';
import RuleBuilderFooter from './RuleBuilderFooter';
import type { ActionItemData } from './ActionItem';

interface Props {
  boardId: string;
  initialAutomation?: Automation;
  onSaved: () => void;
  onCancel: () => void;
}

const RuleBuilder = ({ boardId, initialAutomation, onSaved, onCancel }: Props) => {
  const [selectedTriggerType, setSelectedTriggerType] = useState<TriggerType | null>(null);
  const [allTriggerTypes, setAllTriggerTypes] = useState<TriggerType[]>([]);
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>(
    initialAutomation?.trigger?.config ?? {}
  );

  useEffect(() => {
    getTriggerTypes()
      .then((res) => setAllTriggerTypes(res.data))
      .catch(() => {});
  }, []);
  const [actions, setActions] = useState<ActionItemData[]>(
    initialAutomation?.actions.map((a) => ({
      id: a.id,
      actionType: a.actionType,
      // Derive a display label from the actionType string when editing.
      label: a.actionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      config: a.config,
    })) ?? []
  );
  const [ruleName, setRuleName] = useState(initialAutomation?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialTriggerTypeStr = initialAutomation?.trigger?.triggerType ?? null;

  const activeTriggerTypeStr = selectedTriggerType?.type ?? initialTriggerTypeStr;

  // In edit mode, resolve the full TriggerType object from the fetched list so TriggerConfig
  // can render its config fields even before the user interacts with the picker.
  const activeTriggerType =
    selectedTriggerType ??
    (initialTriggerTypeStr
      ? (allTriggerTypes.find((t) => t.type === initialTriggerTypeStr) ?? null)
      : null);

  const canSave =
    !!activeTriggerTypeStr && actions.length > 0 && ruleName.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);

    try {
      const actionsPayload = actions.map((a, i) => ({
        actionType: a.actionType,
        position: i,
        config: a.config,
      }));

      if (initialAutomation) {
        await updateAutomation({
          boardId,
          automationId: initialAutomation.id,
          patch: {
            name: ruleName.trim(),
            trigger: {
              triggerType: activeTriggerTypeStr!,
              config: triggerConfig,
            },
            actions: actionsPayload,
          },
        });
      } else {
        await createAutomation({
          boardId,
          payload: {
            name: ruleName.trim(),
            automationType: 'RULE',
            trigger: {
              triggerType: activeTriggerTypeStr!,
              config: triggerConfig,
            },
            actions: actionsPayload,
          },
        });
      }
      onSaved();
    } catch {
      setError('Failed to save rule. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Sub-header */}
      <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-3 shrink-0">
        <button
          type="button"
          className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
          onClick={onCancel}
          aria-label="Back to rules list"
        >
          <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
        </button>
        <h3 className="text-sm font-semibold text-slate-200">
          {initialAutomation ? 'Edit rule' : 'New rule'}
        </h3>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {/* Trigger section */}
        <section>
          <TriggerPicker
            selectedType={activeTriggerTypeStr}
            onSelect={(t) => {
              // Only reset config when the trigger type actually changes.
              if (t.type !== activeTriggerTypeStr) setTriggerConfig({});
              setSelectedTriggerType(t);
            }}
          />
          {activeTriggerType && hasConfigFields(activeTriggerType.configSchema) && (
            <div className="mt-3">
              <TriggerConfig
                triggerType={activeTriggerType}
                config={triggerConfig}
                onChange={setTriggerConfig}
                boardId={boardId}
              />
            </div>
          )}
        </section>

        {/* Actions section */}
        <section>
          <ActionList actions={actions} onChange={setActions} boardId={boardId} />
        </section>

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <RuleBuilderFooter
        ruleName={ruleName}
        onRuleNameChange={setRuleName}
        canSave={canSave}
        saving={saving}
        onSave={handleSave}
        onCancel={onCancel}
      />
    </div>
  );
};

export default RuleBuilder;
