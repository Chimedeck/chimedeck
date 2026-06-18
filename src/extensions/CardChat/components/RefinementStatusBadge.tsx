// RefinementStatusBadge — compact badge showing card-chat session status.
// Sprint 171: DRAFT (no session) → REFINING (ACTIVE_REFINEMENT) → READY (READY_FOR_REVIEW).
import type { CardChatSession } from '../api';

interface Props {
  session: CardChatSession | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  IDLE: {
    label: 'DRAFT',
    color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
  ACTIVE_REFINEMENT: {
    label: 'REFINING',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  PAUSED: {
    label: 'PAUSED',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  READY_FOR_REVIEW: {
    label: 'READY',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
};

const DRAFT = {
  label: 'DRAFT',
  color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const RefinementStatusBadge = ({ session }: Props) => {
  const status = session?.status;
  const config = (status && STATUS_LABELS[status]) || DRAFT;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.color}`}
    >
      {config.label}
    </span>
  );
};

export default RefinementStatusBadge;
