// QuickStartTemplates — 3 template cards shown above the schedule list for first-time users.
// Each card opens the appropriate builder pre-populated with its config.
import { CalendarDaysIcon, ExclamationCircleIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';
import type { FC } from 'react';
import type { CreateAutomationPayload } from '../../types';

import translations from '../../translations/en.json';

export interface QuickStartTemplate {
  id: string;
  title: string;
  description: string;
  type: 'scheduled' | 'duedate';
  payload: Partial<CreateAutomationPayload>;
}

// Pre-defined quick-start templates matching the spec.
export const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  {
    id: 'weekly-cleanup',
    title: 'Weekly board cleanup',
    description: 'Every Monday: archive cards in Done and move Next Sprint → To Do',
    type: 'scheduled',
    payload: {
      name: 'Weekly board cleanup',
      automationType: 'SCHEDULED',
      trigger: {
        triggerType: 'schedule',
        config: {
          scheduleType: 'weekly',
          dayOfWeek: 1,   // Monday
          hour: 9,
          minute: 0,
        },
      },
      actions: [
        { actionType: 'list.archive_all_cards', position: 0, config: { listName: 'Done' } },
        { actionType: 'list.move_all_cards', position: 1, config: { sourceListName: 'Next Sprint', targetListName: 'To Do' } },
      ],
    },
  },
  {
    id: 'overdue-flagging',
    title: 'Overdue flagging',
    description: 'On the due date: add red label and post a status comment',
    type: 'duedate',
    payload: {
      name: 'Overdue flagging',
      automationType: 'DUE_DATE',
      trigger: {
        triggerType: 'due_date',
        config: { triggerMoment: 'on' },
      },
      actions: [
        { actionType: 'card.add_label', position: 0, config: { color: 'red' } },
        { actionType: 'card.add_comment', position: 1, config: { text: '@card What\'s the status?' } },
      ],
    },
  },
  {
    id: 'monthly-archive',
    title: 'Monthly archive',
    description: '1st of every month: archive all cards in Done',
    type: 'scheduled',
    payload: {
      name: 'Monthly archive',
      automationType: 'SCHEDULED',
      trigger: {
        triggerType: 'schedule',
        config: {
          scheduleType: 'monthly',
          dayOfMonth: 1,
          hour: 8,
          minute: 0,
        },
      },
      actions: [
        { actionType: 'list.archive_all_cards', position: 0, config: { listName: 'Done' } },
      ],
    },
  },
];

const ICONS = {
  'weekly-cleanup': CalendarDaysIcon,
  'overdue-flagging': ExclamationCircleIcon,
  'monthly-archive': ArchiveBoxIcon,
} as const;

interface Props {
  onUseTemplate: (template: QuickStartTemplate) => void;
}

const QuickStartTemplates: FC<Props> = ({ onUseTemplate }) => (
  <div className="px-4 pt-4 pb-2">
    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
      {translations['automation.quickStartTemplates.heading']}
    </p>
    <div className="flex flex-col gap-2">
      {QUICK_START_TEMPLATES.map((tpl) => {
        const Icon = ICONS[tpl.id as keyof typeof ICONS] ?? CalendarDaysIcon;
        return (
          <button
            key={tpl.id}
            onClick={() => onUseTemplate(tpl)}
            className="flex items-start gap-3 rounded-md border border-slate-700 bg-slate-800 px-3 py-3 text-left hover:border-blue-500 hover:bg-slate-750 transition-colors group"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 group-hover:text-blue-400" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-200 group-hover:text-white">{tpl.title}</p>
              <p className="mt-0.5 text-xs text-slate-400">{tpl.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

export default QuickStartTemplates;
