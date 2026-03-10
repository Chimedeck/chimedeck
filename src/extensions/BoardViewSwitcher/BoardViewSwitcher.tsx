// BoardViewSwitcher — tab bar for switching between Kanban, Table, Calendar, and Timeline views.
// Sprint 52: on mount, fetches the persisted view preference via GET /boards/:id/view-preference.
// On tab click, optimistically updates the active view then PUTs the new preference.
import { useViewPreference } from './hooks';
import BoardViewTab from './BoardViewTab';
import { VIEW_TYPES } from './constants';
import type { ViewType } from './types';

interface Props {
  boardId: string;
}

const BoardViewSwitcher = ({ boardId }: Props) => {
  const { activeView, switchView } = useViewPreference({ boardId });

  return (
    <div
      role="tablist"
      aria-label="Board view"
      className="flex gap-1 border-b border-slate-700 px-4"
      data-testid="board-view-switcher"
    >
      {VIEW_TYPES.map((viewType: ViewType) => (
        <BoardViewTab
          key={viewType}
          viewType={viewType}
          isActive={activeView === viewType}
          onClick={switchView}
        />
      ))}
    </div>
  );
};

export default BoardViewSwitcher;
