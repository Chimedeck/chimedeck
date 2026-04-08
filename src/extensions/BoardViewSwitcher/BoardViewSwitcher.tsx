// BoardViewSwitcher — tab bar for switching between Kanban, Table, Calendar, and Timeline views.
// Sprint 52: on mount, fetches the persisted view preference via GET /boards/:id/view-preference.
// On tab click, optimistically updates the active view then PUTs the new preference.
import { useViewPreference } from './hooks';
import BoardViewTab from './BoardViewTab';
import { VIEW_TYPES } from './constants';
import type { ViewType } from './types';

interface Props {
  boardId: string;
  /** When true the switcher sits over a board background — apply frosted-glass-aware styles. */
  hasBackground?: boolean;
  /**
   * When true, renders only the tab buttons with no wrapper div.
   * Use when embedding inside a parent that provides layout context.
   */
  inline?: boolean;
  /**
   * When true, renders a segmented control: a single rounded pill container
   * where the active item gets an inset raised background.
   */
  segmented?: boolean;
}

const BoardViewSwitcher = ({ boardId, hasBackground = false, inline = false, segmented = false }: Props) => {
  const { activeView, switchView } = useViewPreference({ boardId });

  const tabElements = VIEW_TYPES.map((viewType: ViewType) => (
    <BoardViewTab
      key={viewType}
      viewType={viewType}
      isActive={activeView === viewType}
      onClick={switchView}
      hasBackground={hasBackground}
      segmented={segmented}
    />
  ));

  if (inline) {
    return <>{tabElements}</>;
  }

  if (segmented) {
    // Underline-style group: no pill container, just flush tab buttons
    return (
      <div
        role="tablist"
        aria-label="Board view"
        className="inline-flex items-center"
        data-testid="board-view-switcher"
      >
        {tabElements}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="Board view"
      className={`flex gap-1 border-b px-4${hasBackground ? ' border-black/10' : ' border-border'}`}
      data-testid="board-view-switcher"
    >
      {tabElements}
    </div>
  );
};

export default BoardViewSwitcher;
