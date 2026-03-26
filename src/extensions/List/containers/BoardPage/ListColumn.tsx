// BoardPage/ListColumn — sortable list column using @dnd-kit/sortable.
// Provides drag handle for list reorder and a SortableContext for card items.
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useRef, useState } from 'react';
import type { List } from '../../api';
import type { Card } from '../../../Card/api';
import ListHeader from '../../components/ListHeader';
import CardItem from '../../../Card/components/CardItem';
import type { CustomFieldValue } from '../../../CustomFields/types';
import AddCardForm from '../../../Card/components/AddCardForm';

interface Props {
  list: List;
  cardIds: string[];
  cards: Record<string, Card>;
  boardId?: string;
  boardTitle?: string;
  onRename: (listId: string, title: string) => void;
  onArchive: (listId: string) => void;
  onDelete: (listId: string) => void;
  onAddCard: (listId: string, title: string) => Promise<void>;
  onCardClick?: (cardId: string) => void;
  labelsExpanded?: boolean;
  onToggleLabels?: () => void;
  /** Pre-fetched custom field values for all cards on this board, keyed by cardId.
   *  null = batch not yet loaded — tiles render no badges rather than firing per-card requests. */
  customFieldValuesMap?: Record<string, CustomFieldValue[]> | null;
  /** True when the current user is a VIEWER guest — hides the Add card button. */
  isViewerGuest?: boolean;
}

const SortableListColumn = ({
  list,
  cardIds,
  cards,
  boardId,
  boardTitle,
  onRename,
  onArchive,
  onDelete,
  onAddCard,
  onCardClick,
  labelsExpanded,
  onToggleLabels,
  customFieldValuesMap,
  isViewerGuest = false,
}: Props) => {
  const [addingCard, setAddingCard] = useState(false);
  // WHY: stable noop so CardItem (memo'd) doesn't re-render when onToggleLabels
  // is not provided. An inline `() => {}` creates a new reference every render.
  const noopRef = useRef(() => {});
  const stableToggleLabels = useCallback(
    onToggleLabels ?? noopRef.current,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onToggleLabels],
  );

  // Sortable hook for the list column itself (horizontal reorder)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const listCardObjects = cardIds
    .map((id) => cards[id])
    .filter((c): c is Card => c !== undefined);

  return (
    <div
      ref={setNodeRef}
      id={`board-list-${list.id}`}
      style={style}
      className="w-72 shrink-0 bg-bg-surface/90 backdrop-blur-sm border border-border rounded-xl flex flex-col h-full"
      role="listitem"
      aria-label={`List: ${list.title}`}
    >
      {/* Drag handle is the list header */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <ListHeader
          list={list}
          cardCount={cardIds.length}
          onRename={(title) => onRename(list.id, title)}
          onArchive={() => onArchive(list.id)}
          onDelete={() => onDelete(list.id)}
        />
      </div>

      {/* Cards — vertically sortable */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 py-2 min-h-[2rem]">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {listCardObjects.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              listTitle={list.title}
              {...(typeof boardTitle === 'string' ? { boardTitle } : {})}
              {...(boardId ? { boardId } : {})}
              labelsExpanded={labelsExpanded ?? false}
              onToggleLabels={stableToggleLabels}
              {...(onCardClick ? { onClick: onCardClick } : {})}
              {...(customFieldValuesMap !== null && customFieldValuesMap !== undefined ? { customFieldValues: customFieldValuesMap[card.id] ?? [] } : {})}
            />
          ))}
        </SortableContext>
      </div>

      {/* Add card footer — hidden for VIEWER guests */}
      <div className="px-1 pb-2">
        {!isViewerGuest && (addingCard ? (
          <AddCardForm
            listId={list.id}
            onSubmit={async (listId, title) => {
              await onAddCard(listId, title);
              setAddingCard(false);
            }}
            onCancel={() => setAddingCard(false)}
          />
        ) : (
          <button
            className="text-muted hover:text-base hover:bg-bg-overlay text-sm rounded-lg px-2 py-1.5 w-full text-left transition-colors"
            onClick={() => setAddingCard(true)}
            aria-label={`Add a card to ${list.title}`}
          >
            + Add a card
          </button>
        ))}
      </div>
    </div>
  );
};

export default SortableListColumn;
