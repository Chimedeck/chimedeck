// BoardPage/ListColumn — sortable list column using @dnd-kit/sortable.
// Provides drag handle for list reorder and a SortableContext for card items.
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Fragment, memo, useCallback, useMemo, useRef, useState } from 'react';
import type { List } from '../../api';
import type { Card } from '../../../Card/api';
import ListHeader from '../../components/ListHeader';
import CardItem from '../../../Card/components/CardItem';
import type { CustomFieldValue } from '../../../CustomFields/types';
import AddCardForm from '../../../Card/components/AddCardForm';
import Button from '../../../../common/components/Button';

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
  /** When true the column sits over a board background image — apply solid (opaque) column body. */
  hasBackground?: boolean;
  /** Predicted insertion index for drag placeholder in this list. */
  dragPlaceholderIndex?: number;
  /** Measured height of the currently dragged card for exact placeholder dimensions. */
  dragPlaceholderHeight?: number;
  /** Active dragged card id so we can hide source slot and avoid double gaps. */
  activeDragCardId?: string | null;
}

const EMPTY_CUSTOM_FIELD_VALUES: CustomFieldValue[] = [];

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
  hasBackground = false,
  dragPlaceholderIndex,
  dragPlaceholderHeight,
  activeDragCardId = null,
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

  const listCardObjects = useMemo(
    () => cardIds
      .filter((id) => id !== activeDragCardId)
      .map((id) => cards[id])
      .filter((c): c is Card => c !== undefined),
    [activeDragCardId, cardIds, cards],
  );
  const resolvedPlaceholderHeight =
    typeof dragPlaceholderHeight === 'number' && Number.isFinite(dragPlaceholderHeight) && dragPlaceholderHeight >= 24
      ? dragPlaceholderHeight
      : 72;
  const normalizedPlaceholderIndex =
    typeof dragPlaceholderIndex === 'number' && Number.isFinite(dragPlaceholderIndex)
      ? Math.max(0, Math.min(Math.floor(dragPlaceholderIndex), listCardObjects.length))
      : null;

  const placeholderNode = (
    <div
      className="shrink-0 rounded-lg border border-border bg-bg-surface/70"
      style={{ height: resolvedPlaceholderHeight }}
      aria-hidden="true"
    />
  );

  return (
    <div
      ref={setNodeRef}
      id={`board-list-${list.id}`}
      style={style}
      className={`w-72 shrink-0 border border-border rounded-xl flex flex-col h-full ${hasBackground ? 'bg-bg-surface' : 'bg-bg-surface/90 backdrop-blur-sm'}`}
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
          hasBackground={hasBackground}
        />
      </div>

      {/* Cards — vertically sortable */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 py-2 min-h-[2rem]">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {listCardObjects.map((card, idx) => (
            <Fragment key={card.id}>
              {normalizedPlaceholderIndex === idx && placeholderNode}
              <CardItem
                card={card}
                listTitle={list.title}
                {...(typeof boardTitle === 'string' ? { boardTitle } : {})}
                {...(boardId ? { boardId } : {})}
                labelsExpanded={labelsExpanded ?? false}
                onToggleLabels={stableToggleLabels}
                {...(onCardClick ? { onClick: onCardClick } : {})}
                {...(customFieldValuesMap !== null && customFieldValuesMap !== undefined ? { customFieldValues: customFieldValuesMap[card.id] ?? EMPTY_CUSTOM_FIELD_VALUES } : {})}
              />
            </Fragment>
          ))}
          {normalizedPlaceholderIndex === listCardObjects.length && placeholderNode}
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
          <Button
            variant="ghost"
            className="w-full justify-start rounded-lg px-2 py-1.5 text-sm"
            onClick={() => setAddingCard(true)}
            aria-label={`Add a card to ${list.title}`}
          >
            + Add a card
          </Button>
        ))}
      </div>
    </div>
  );
};

function areEqual(prev: Props, next: Props): boolean {
  return prev.list === next.list
    && prev.cardIds === next.cardIds
    && prev.cards === next.cards
    && prev.boardId === next.boardId
    && prev.boardTitle === next.boardTitle
    && prev.onRename === next.onRename
    && prev.onArchive === next.onArchive
    && prev.onDelete === next.onDelete
    && prev.onAddCard === next.onAddCard
    && prev.onCardClick === next.onCardClick
    && prev.labelsExpanded === next.labelsExpanded
    && prev.onToggleLabels === next.onToggleLabels
    && prev.customFieldValuesMap === next.customFieldValuesMap
    && prev.isViewerGuest === next.isViewerGuest
    && prev.hasBackground === next.hasBackground
    && prev.dragPlaceholderIndex === next.dragPlaceholderIndex
    && prev.dragPlaceholderHeight === next.dragPlaceholderHeight
    && prev.activeDragCardId === next.activeDragCardId;
}

export default memo(SortableListColumn, areEqual);
