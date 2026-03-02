// BoardPage/ListColumn — sortable list column using @dnd-kit/sortable.
// Provides drag handle for list reorder and a SortableContext for card items.
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import type { List } from '../../api';
import type { Card } from '../../../Card/api';
import ListHeader from '../../components/ListHeader';
import CardItem from '../../../Card/components/CardItem';
import AddCardForm from '../../../Card/components/AddCardForm';

interface Props {
  list: List;
  cardIds: string[];
  cards: Record<string, Card>;
  onRename: (listId: string, title: string) => void;
  onArchive: (listId: string) => void;
  onDelete: (listId: string) => void;
  onAddCard: (listId: string, title: string) => Promise<void>;
  onCardClick?: (cardId: string) => void;
}

const SortableListColumn = ({
  list,
  cardIds,
  cards,
  onRename,
  onArchive,
  onDelete,
  onAddCard,
  onCardClick,
}: Props) => {
  const [addingCard, setAddingCard] = useState(false);

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
      style={style}
      className="w-72 shrink-0 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl flex flex-col max-h-[calc(100vh-140px)]"
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
              {...(onCardClick ? { onClick: onCardClick } : {})}
            />
          ))}
        </SortableContext>
      </div>

      {/* Add card footer */}
      <div className="px-1 pb-2">
        {addingCard ? (
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
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm rounded-lg px-2 py-1.5 w-full text-left transition-colors"
            onClick={() => setAddingCard(true)}
            aria-label={`Add a card to ${list.title}`}
          >
            + Add a card
          </button>
        )}
      </div>
    </div>
  );
};

export default SortableListColumn;
