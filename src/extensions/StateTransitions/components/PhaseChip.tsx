// PhaseChip — visual tag for a workflow phase on a column node.
// Sprint 172: Each phase gets a distinct colour to make the graph quickly scannable.

import type { WorkflowPhase } from '../../api';

interface Props {
  phase: WorkflowPhase;
}

// [why] Distinct colours per phase help users visually identify column
// purpose at a glance on the state-transition graph.
const PHASE_COLORS: Record<WorkflowPhase, string> = {
  NEW_DRAFT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  REFINED_PENDING_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  SYNC_DOCUMENT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  READY_FOR_DEV: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  GENERATE_SPRINT: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  UPDATE_AS_BUILT: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
};

const PHASE_LABELS: Record<WorkflowPhase, string> = {
  NEW_DRAFT: 'New Draft',
  REFINED_PENDING_REVIEW: 'Pending Review',
  SYNC_DOCUMENT: 'Sync Doc',
  READY_FOR_DEV: 'Ready for Dev',
  GENERATE_SPRINT: 'Generate Sprint',
  UPDATE_AS_BUILT: 'As-Built',
};

const PhaseChip = ({ phase }: Props) => {
  const colorClass =
    PHASE_COLORS[phase] ?? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
  const label = PHASE_LABELS[phase] ?? phase;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight ${colorClass}`}
    >
      {label}
    </span>
  );
};

export default PhaseChip;
