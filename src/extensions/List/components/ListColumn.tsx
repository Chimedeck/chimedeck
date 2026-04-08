// ListColumn — a vertical card column representing a single list on the board.
// Accepts drag-and-drop via @dnd-kit/sortable attributes passed from the parent.
import type { List } from '../api';
import ListHeader from './ListHeader';

interface Props {
  list: List;
  // Drag handle props injected by the sortable hook in the container
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
  onRename: (listId: string, title: string) => void;
  onArchive: (listId: string) => void;
  onDelete: (listId: string) => void;
  children?: React.ReactNode;
}

const ListColumn = ({
  list,
  dragHandleProps = {},
  style,
  onRename,
  onArchive,
  onDelete,
  children,
}: Props) => {
  return (
    <div
      className="flex w-64 shrink-0 flex-col rounded-lg bg-bg-overlay shadow"
      style={style}
      aria-label={`List: ${list.title}`}
    >
      {/* Drag handle wraps the header for keyboard-accessible reordering */}
      <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing">
        <ListHeader
          list={list}
          onRename={(title) => onRename(list.id, title)}
          onArchive={() => onArchive(list.id)}
          onDelete={() => onDelete(list.id)}
        />
      </div>

      {/* Card slot — cards will be rendered here from sprint 07 */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-2 min-h-[2rem]">
        {children}
      </div>
    </div>
  );
};

export default ListColumn;
