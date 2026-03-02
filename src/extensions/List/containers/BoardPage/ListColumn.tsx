// BoardPage/ListColumn — drag target column for the board, wired to the list reorder hook.
// Uses native HTML5 drag events for keyboard-accessible reordering without an extra package.
import { useRef } from 'react';
import ListColumn from '../../components/ListColumn';
import type { List } from '../../api';

interface Props {
  list: List;
  index: number;
  onDragStart: (index: number) => void;
  onDrop: (toIndex: number) => void;
  onRename: (listId: string, title: string) => void;
  onArchive: (listId: string) => void;
  onDelete: (listId: string) => void;
  children?: React.ReactNode;
}

const DraggableListColumn = ({
  list,
  index,
  onDragStart,
  onDrop,
  onRename,
  onArchive,
  onDelete,
  children,
}: Props) => {
  const dragOver = useRef(false);

  const handleDragStart = () => onDragStart(index);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dragOver.current = true;
  };
  const handleDragLeave = () => { dragOver.current = false; };
  const handleDrop = () => {
    dragOver.current = false;
    onDrop(index);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="listitem"
    >
      <ListColumn
        list={list}
        onRename={onRename}
        onArchive={onArchive}
        onDelete={onDelete}
      >
        {children}
      </ListColumn>
    </div>
  );
};

export default DraggableListColumn;
