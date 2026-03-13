// VisibilityBadge — small chip indicating board visibility level.
import type { BoardVisibility } from '../api';

interface Props {
  visibility: BoardVisibility;
}

const CONFIG: Record<BoardVisibility, { label: string; className: string; icon: string }> = {
  PRIVATE: {
    label: 'Private',
    className: 'bg-slate-600/80 text-slate-200',
    icon: '🔒',
  },
  WORKSPACE: {
    label: 'Workspace',
    className: 'bg-blue-600/80 text-blue-100',
    icon: '👥',
  },
  PUBLIC: {
    label: 'Public',
    className: 'bg-green-600/80 text-green-100',
    icon: '🌐',
  },
};

const VisibilityBadge = ({ visibility }: Props) => {
  const { label, className, icon } = CONFIG[visibility] ?? CONFIG.PRIVATE;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      aria-label={`Board visibility: ${label}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
};

export default VisibilityBadge;
