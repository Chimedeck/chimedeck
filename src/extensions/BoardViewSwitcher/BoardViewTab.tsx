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
  /** When true, applies frosted-glass-aware styles. */
  hasBackground?: boolean;
  /** When true, renders as an item inside a segmented control container. */
  segmented?: boolean;
}

const BoardViewTab = ({ viewType, isActive, onClick, hasBackground = false, segmented = false }: Props) => {
  const Icon = VIEW_ICONS[viewType];
  let stateClass: string;
  if (segmented) {
    // Underline-style inside the view switcher — no pill background
    if (isActive) {
      stateClass = hasBackground
        ? 'text-white font-medium border-b-2 border-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]'
        : 'text-primary font-medium border-b-2 border-primary';
    } else {
      stateClass = hasBackground
        ? 'text-white/80 border-b-2 border-transparent hover:text-white hover:bg-white/15 rounded transition-colors [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]'
        : 'text-muted border-b-2 border-transparent hover:text-base transition-colors';
    }
  } else if (isActive) {
    stateClass = hasBackground ? 'bg-black/[0.08] rounded-[4px] font-semibold' : 'bg-blue-50 text-blue-600 font-semibold';
  } else {
    stateClass = hasBackground ? 'opacity-60 hover:opacity-100' : 'text-muted hover:bg-bg-surface hover:text-base';
  }
  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-label={LABELS[viewType]}
      onClick={() => onClick(viewType)}
      data-testid={`board-view-tab-${viewType}`}
      className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${stateClass}`}
    >
      <Icon className="h-4 w-4" />
      {LABELS[viewType]}
    </button>
  );
};

export default BoardViewTab;
