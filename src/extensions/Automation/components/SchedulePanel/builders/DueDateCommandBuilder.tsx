// DueDateCommandBuilder — 2-step modal for creating/editing DUE_DATE automations.
// Steps: 1. When (offset config)  2. Actions + Name + Save
import { useState, useMemo } from 'react';
import {
  XMarkIcon,
  ExclamationCircleIcon,
  BellAlertIcon,
  BellSlashIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline';
import type { FC } from 'react';
import Button from '../../../../../common/components/Button';
import ActionList from '../../AutomationPanel/RuleBuilder/ActionList';
import type { ActionItemData } from '../../AutomationPanel/RuleBuilder/ActionItem';
import { createAutomation, updateAutomation } from '../../../api';
import type { Automation } from '../../../types';
import {
  dueDateSummary,
  type TriggerMoment,
  type DueDateConfig,
} from '../../../utils/scheduleSummary';
import translations from '../../../translations/en.json';

interface Props {
  boardId: string;
  existing?: Automation;
  /** Pre-populated config (e.g. from a quick-start template). */
  initialConfig?: Partial<DueDateConfig>;
  onSave: (automation: Automation) => void;
  onClose: () => void;
}

/** Extract due-date config stored in automation.trigger.config */
function parseExistingConfig(a?: Automation): Partial<DueDateConfig> {
  if (!a?.trigger?.config) return {};
  return a.trigger.config as Partial<DueDateConfig>;
}

const DueDateCommandBuilder: FC<Props> = ({
  boardId,
  existing,
  initialConfig,
  onSave,
  onClose,
}) => {
  const existingConfig = parseExistingConfig(existing);
  const merged: Partial<DueDateConfig> = { ...existingConfig, ...initialConfig };

  // Step state: 1 | 2
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — when config
  const [triggerMoment, setTriggerMoment] = useState<TriggerMoment>(
    merged.triggerMoment ?? 'before',
  );
  const [offsetValue, setOffsetValue] = useState<number>(merged.offsetValue ?? 2);
  const [offsetUnit, setOffsetUnit] = useState<'days' | 'hours'>(merged.offsetUnit ?? 'days');

  // Step 2 — actions + name
  const [actions, setActions] = useState<ActionItemData[]>(
    existing?.actions.map((a) => ({
      id: a.id,
      actionType: a.actionType,
      label: a.actionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      config: a.config as Record<string, unknown>,
    })) ??
      initialConfig
        ? []
        : [],
  );
  const [nameOverride, setNameOverride] = useState<string | null>(existing?.name ?? null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build the config for summary + save.
  // Spread conditionally to satisfy exactOptionalPropertyTypes.
  const dueDateConfig: DueDateConfig = useMemo(
    () => ({
      triggerMoment,
      ...(triggerMoment !== 'on' ? { offsetValue, offsetUnit } : {}),
    }),
    [triggerMoment, offsetValue, offsetUnit],
  );

  const autoSummary = dueDateSummary(dueDateConfig);
  const commandName = nameOverride !== null ? nameOverride : autoSummary;

  const canProceedStep1 =
    triggerMoment === 'on' || (offsetValue >= 1 && offsetValue <= 30);
  const canSave = commandName.trim().length > 0 && actions.length > 0;

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

      const triggerConfig: Record<string, unknown> = {
        triggerMoment,
      };
      if (triggerMoment !== 'on') {
        triggerConfig.offsetValue = offsetValue;
        triggerConfig.offsetUnit = offsetUnit;
      }

      if (existing) {
        const res = await updateAutomation({
          boardId,
          automationId: existing.id,
          patch: {
            name: commandName.trim(),
            trigger: { triggerType: 'due_date', config: triggerConfig },
            actions: actionsPayload,
          },
        });
        onSave(res.data);
      } else {
        const res = await createAutomation({
          boardId,
          payload: {
            name: commandName.trim(),
            automationType: 'DUE_DATE',
            trigger: { triggerType: 'due_date', config: triggerConfig },
            actions: actionsPayload,
          },
        });
        onSave(res.data);
      }
    } catch {
      setError('Failed to save due-date command. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label={existing ? translations['automation.dueDateBuilder.ariaLabelEdit'] : translations['automation.dueDateBuilder.ariaLabelNew']}
    >
      <div className="bg-bg-base border border-border rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <ExclamationCircleIcon className="h-5 w-5 text-amber-400 flex-shrink-0" aria-hidden="true" />
          <h2 className="flex-1 text-base font-semibold text-base">
            {existing ? translations['automation.dueDateBuilder.titleEdit'] : translations['automation.dueDateBuilder.titleNew']}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={onClose}
            aria-label={translations['automation.dueDateBuilder.close']}
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-5 pt-4 pb-0">
          {([1, 2] as const).map((n) => (
            <div key={n} className="flex items-center gap-1">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step === n
                    ? 'bg-primary text-white' // [theme-exception] text-white on active-state primary button
                    : step > n
                    ? 'bg-success text-white' // [theme-exception] text-white on completed success step
                    : 'bg-bg-overlay text-muted'
                }`}
              >
                {n}
              </div>
              <span className={`text-xs ${step === n ? 'text-subtle' : 'text-muted'}`}>
                {n === 1 ? translations['automation.dueDateBuilder.stepWhen'] : translations['automation.dueDateBuilder.stepActionsAndSave']}
              </span>
              {n < 2 && <span className="mx-1 text-muted text-xs">›</span>}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5 max-h-[60vh]">
          {/* ── Step 1: When config ── */}
          {step === 1 && (
            <>
              {/* Timing selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted uppercase tracking-wide">
                  {translations['automation.dueDateBuilder.timingLabel']}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { value: 'before', label: translations['automation.dueDateBuilder.timingBefore'], Icon: BellAlertIcon },
                      { value: 'on', label: translations['automation.dueDateBuilder.timingOnDay'], Icon: ExclamationCircleIcon },
                      { value: 'after', label: translations['automation.dueDateBuilder.timingAfter'], Icon: BellSlashIcon },
                    ] as const
                  ).map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTriggerMoment(value as TriggerMoment)}
                      className={`flex flex-col items-center gap-1 rounded-md py-2.5 px-2 text-xs font-medium transition-colors ${
                        triggerMoment === value
                          ? 'bg-primary text-white' // [theme-exception]: text-white on active-state primary button
                          : 'bg-bg-surface text-subtle hover:bg-bg-overlay'
                      }`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Offset config (not shown for 'on') */}
              {triggerMoment !== 'on' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted uppercase tracking-wide">
                    {translations['automation.dueDateBuilder.offsetLabel']}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={offsetValue}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(30, Number(e.target.value)));
                        setOffsetValue(v);
                      }}
                      className="w-20 rounded-md bg-bg-overlay border border-border px-3 py-2 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label={translations['automation.dueDateBuilder.offsetAriaLabel']}
                    />
                    <div className="flex gap-1">
                      {(['days', 'hours'] as const).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setOffsetUnit(u)}
                          className={`rounded-md px-3 py-2 text-xs font-medium capitalize transition-colors ${
                            offsetUnit === u
                              ? 'bg-primary text-white' // [theme-exception] text-white on active-state primary button
                              : 'bg-bg-surface text-subtle hover:bg-bg-overlay'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(offsetValue < 1 || offsetValue > 30) && (
                    <p className="text-xs text-danger">{translations['automation.dueDateBuilder.offsetError']}</p>
                  )}
                </div>
              )}

              {/* Live preview */}
              <p className="text-xs text-muted italic">
                {translations['automation.dueDateBuilder.triggerLabel']}: <span className="text-subtle">{autoSummary}</span>
              </p>
            </>
          )}

          {/* ── Step 2: Actions + Name + Save ── */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              {/* Actions */}
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted">
                  {translations['automation.dueDateBuilder.actionsHint']}
                </p>
                <ActionList actions={actions} onChange={setActions} />
                {actions.length === 0 && (
                  <p className="text-xs text-amber-400">{translations['automation.dueDateBuilder.actionsWarning']}</p>
                )}
              </div>

              {/* Schedule summary */}
              <div className="rounded-md bg-bg-surface border border-border px-3 py-2 text-sm text-subtle">
                <span className="text-xs text-muted block mb-1">{translations['automation.dueDateBuilder.triggerSummaryLabel']}</span>
                {autoSummary}
              </div>

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="due-date-name"
                  className="text-xs font-medium text-muted uppercase tracking-wide"
                >
                  {translations['automation.dueDateBuilder.commandNameLabel']}
                </label>
                <input
                  id="due-date-name"
                  type="text"
                  value={commandName}
                  onChange={(e) => setNameOverride(e.target.value)}
                  maxLength={120}
                  className="rounded-md bg-bg-overlay border border-border px-3 py-2 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={translations['automation.dueDateBuilder.commandNamePlaceholder']}
                />
                <p className="text-xs text-muted">
                  {translations['automation.dueDateBuilder.commandNameHint']}
                </p>
              </div>

              {error && (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <Button
            variant="secondary"
            type="button"
            onClick={step === 1 ? onClose : () => setStep(1)}
            className="flex items-center gap-1"
          >
            {step === 1 ? (
              translations['automation.dueDateBuilder.cancel']
            ) : (
              <>
                <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
                {translations['automation.dueDateBuilder.back']}
              </>
            )}
          </Button>

          {step === 1 ? (
            <Button
              variant="primary"
              type="button"
              disabled={!canProceedStep1}
              onClick={() => setStep(2)}
            >
              {translations['automation.dueDateBuilder.next']}
            </Button>
          ) : (
            <Button
              variant="primary"
              type="button"
              disabled={!canSave || saving}
              onClick={handleSave}
            >
              {saving ? translations['automation.dueDateBuilder.saving'] : existing ? translations['automation.dueDateBuilder.saveChanges'] : translations['automation.dueDateBuilder.create']}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DueDateCommandBuilder;
