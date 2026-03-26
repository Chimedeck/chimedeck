// Single tab button for the BoardViewSwitcher bar.
import type { ViewType } from './types';
import { VIEW_ICONS } from './icons';

const LABELS: Record<ViewType, string> = {
  KANBAN: 'Kanban',
  TABLE: 'Table',
  CALENDAR: 'Calendar',
  TIMELINE: 'Timeline',
};

interface Props {
  viewType: ViewType;
  isActive: boolean;
  onClick: (viewType: ViewType) => void;
}

const BoardViewTab = ({ viewType, isActive, onClick }: Props) => {
  const Icon = VIEW_ICONS[viewType];
  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-label={LABELS[viewType]}
      onClick={() => onClick(viewType)}
      data-testid={`board-view-tab-${viewType}`}
      className={`flex items-center gap-1.5 rounded-t px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'border-b-2 border-blue-500 text-blue-600'
          : 'text-muted hover:text-base'
      }`}
    >
      <Icon className="h-4 w-4" />
      {LABELS[viewType]}
    </button>
  );
};

export default BoardViewTab;
