// SchedulePanel — Schedule tab content for the Automation panel.
// Shows quick-start templates (first-time experience) + two sections: Scheduled / Due Date commands.
import { useState, useCallback } from 'react';
import type { FC } from 'react';
import type { Automation } from '../../types';
import type { ScheduleConfig, DueDateConfig } from '../../utils/scheduleSummary';
import ScheduleList from './ScheduleList';
import ScheduleEmptyState from './ScheduleEmptyState';
import QuickStartTemplates, { type QuickStartTemplate } from './QuickStartTemplates';
import ScheduledCommandBuilder from './builders/ScheduledCommandBuilder';
import DueDateCommandBuilder from './builders/DueDateCommandBuilder';

type BuilderMode =
  | null
  | { type: 'scheduled'; existing?: Automation; initialConfig?: Partial<ScheduleConfig> }
  | { type: 'duedate'; existing?: Automation; initialConfig?: Partial<DueDateConfig> };

interface Props {
  boardId: string;
  /** All board automations — passed from AutomationPanel so we don't fetch twice. */
  automations: Automation[];
  onChanged: () => void;
}

const SchedulePanel: FC<Props> = ({ boardId, automations, onChanged }) => {
  const [builder, setBuilder] = useState<BuilderMode>(null);

  const scheduleAutomations = automations.filter(
    (a) => a.automationType === 'SCHEDULED' || a.automationType === 'DUE_DATE',
  );

  const hasAny = scheduleAutomations.length > 0;

  const handleUseTemplate = useCallback((tpl: QuickStartTemplate) => {
    if (tpl.type === 'scheduled') {
      const triggerCfg = tpl.payload.trigger?.config as Partial<ScheduleConfig> | undefined;
      setBuilder(triggerCfg ? { type: 'scheduled', initialConfig: triggerCfg } : { type: 'scheduled' });
    } else {
      const triggerCfg = tpl.payload.trigger?.config as Partial<DueDateConfig> | undefined;
      setBuilder(triggerCfg ? { type: 'duedate', initialConfig: triggerCfg } : { type: 'duedate' });
    }
  }, []);

  const handleEdit = useCallback((automation: Automation) => {
    if (automation.automationType === 'SCHEDULED') {
      setBuilder({ type: 'scheduled', existing: automation });
    } else {
      setBuilder({ type: 'duedate', existing: automation });
    }
  }, []);

  const handleSaved = useCallback(() => {
    setBuilder(null);
    onChanged();
  }, [onChanged]);

  // Builder overlays — rendered as modals on top of the panel content.
  if (builder?.type === 'scheduled') {
    return (
      <ScheduledCommandBuilder
        boardId={boardId}
        {...(builder.existing ? { existing: builder.existing } : {})}
        {...(builder.initialConfig ? { initialConfig: builder.initialConfig } : {})}
        onSave={handleSaved}
        onClose={() => setBuilder(null)}
      />
    );
  }

  if (builder?.type === 'duedate') {
    return (
      <DueDateCommandBuilder
        boardId={boardId}
        {...(builder.existing ? { existing: builder.existing } : {})}
        {...(builder.initialConfig ? { initialConfig: builder.initialConfig } : {})}
        onSave={handleSaved}
        onClose={() => setBuilder(null)}
      />
    );
  }

  return (
    <div className="flex flex-col">
      {/* Quick-start templates are always visible for discoverability */}
      <QuickStartTemplates onUseTemplate={handleUseTemplate} />

      {/* Divider */}
      <div className="mx-4 border-t border-border my-2" aria-hidden="true" />

      {/* List or empty state */}
      {hasAny ? (
        <ScheduleList
          boardId={boardId}
          automations={scheduleAutomations}
          onCreateScheduled={() => setBuilder({ type: 'scheduled' })}
          onCreateDueDate={() => setBuilder({ type: 'duedate' })}
          onEdit={handleEdit}
          onChanged={onChanged}
        />
      ) : (
        <ScheduleEmptyState
          onCreateScheduled={() => setBuilder({ type: 'scheduled' })}
          onCreateDueDate={() => setBuilder({ type: 'duedate' })}
        />
      )}
    </div>
  );
};

export default SchedulePanel;
