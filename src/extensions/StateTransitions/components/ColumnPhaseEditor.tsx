// ColumnPhaseEditor — inline editor for workflow phases and phase config on a column node.
// Sprint 172: Renders as a section inside the existing column node edit panel.
// Uses multi-select checkboxes for phase assignment and toggle controls for phase config.

import { useState, useCallback } from 'react';
import type { WorkflowPhase, PhaseConfig } from '../../api';

interface Props {
  selectedPhases: WorkflowPhase[];
  phaseConfig: PhaseConfig;
  onChange: (phases: WorkflowPhase[], config: PhaseConfig) => void;
}

const ALL_PHASES: WorkflowPhase[] = [
  'NEW_DRAFT',
  'REFINED_PENDING_REVIEW',
  'SYNC_DOCUMENT',
  'READY_FOR_DEV',
  'GENERATE_SPRINT',
  'UPDATE_AS_BUILT',
];

const PHASE_LABELS: Record<WorkflowPhase, string> = {
  NEW_DRAFT: 'New Draft',
  REFINED_PENDING_REVIEW: 'Refined — Pending Review',
  SYNC_DOCUMENT: 'Sync Document',
  READY_FOR_DEV: 'Ready for Dev',
  GENERATE_SPRINT: 'Generate Sprint',
  UPDATE_AS_BUILT: 'Update As-Built',
};

const ColumnPhaseEditor = ({ selectedPhases, phaseConfig, onChange }: Props) => {
  const [localPhases, setLocalPhases] = useState<Set<WorkflowPhase>>(
    new Set(selectedPhases),
  );
  const [localConfig, setLocalConfig] = useState<PhaseConfig>({
    serviceTierOverride: phaseConfig.serviceTierOverride ?? null,
    autoRun: phaseConfig.autoRun ?? false,
    requiresHumanApproval: phaseConfig.requiresHumanApproval ?? true,
  });

  // [why] Phase checkbox toggles are immediate — no need for a save button.
  // Changes propagate directly to the parent via onChange.
  const handlePhaseToggle = useCallback(
    (phase: WorkflowPhase) => {
      setLocalPhases((prev) => {
        const next = new Set(prev);
        if (next.has(phase)) {
          next.delete(phase);
        } else {
          next.add(phase);
        }
        const phases = Array.from(next);
        onChange(phases, localConfig);
        return next;
      });
    },
    [localConfig, onChange],
  );

  const handleConfigChange = useCallback(
    (key: keyof PhaseConfig, value: boolean | string | null) => {
      setLocalConfig((prev) => {
        const next = { ...prev, [key]: value };
        onChange(Array.from(localPhases), next);
        return next;
      });
    },
    [localPhases, onChange],
  );

  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-secondary">
          Workflow Phases
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {ALL_PHASES.map((phase) => {
            const isSelected = localPhases.has(phase);
            return (
              <label
                key={phase}
                className={`inline-flex cursor-pointer items-center rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  isSelected
                    ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                    : 'bg-slate-100 text-secondary dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isSelected}
                  onChange={() => { handlePhaseToggle(phase); }}
                />
                {PHASE_LABELS[phase]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
        <p className="text-xs font-semibold text-secondary">Phase Configuration</p>

        <label className="flex items-center justify-between">
          <span className="text-xs text-secondary">Auto-Run</span>
          <button
            type="button"
            role="switch"
            aria-checked={localConfig.autoRun}
            onClick={() => { handleConfigChange('autoRun', !localConfig.autoRun); }}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
              localConfig.autoRun ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                localConfig.autoRun ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </label>

        <label className="flex items-center justify-between">
          <span className="text-xs text-secondary">Requires Approval</span>
          <button
            type="button"
            role="switch"
            aria-checked={localConfig.requiresHumanApproval}
            onClick={() => { handleConfigChange('requiresHumanApproval', !localConfig.requiresHumanApproval); }}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
              localConfig.requiresHumanApproval
                ? 'bg-primary'
                : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                localConfig.requiresHumanApproval ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      </div>
    </div>
  );
};

export default ColumnPhaseEditor;
