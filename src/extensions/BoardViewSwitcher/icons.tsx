// Inline SVG icons for each board view type.
import type { ViewType } from './types';

interface IconProps {
  className?: string;
}

export const KanbanIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <rect x="2" y="4" width="4" height="12" rx="1" />
    <rect x="8" y="4" width="4" height="8" rx="1" />
    <rect x="14" y="4" width="4" height="10" rx="1" />
  </svg>
);

export const TableIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <rect x="2" y="3" width="16" height="3" rx="1" />
    <rect x="2" y="8" width="16" height="2.5" rx="0.5" />
    <rect x="2" y="12" width="16" height="2.5" rx="0.5" />
    <rect x="2" y="16" width="16" height="2" rx="0.5" />
  </svg>
);

export const CalendarIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm-2 5h12v8H4V7z"
      clipRule="evenodd"
    />
  </svg>
);

export const TimelineIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="6" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="4" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const VIEW_ICONS: Record<ViewType, React.ComponentType<IconProps>> = {
  KANBAN: KanbanIcon,
  TABLE: TableIcon,
  CALENDAR: CalendarIcon,
  TIMELINE: TimelineIcon,
};
