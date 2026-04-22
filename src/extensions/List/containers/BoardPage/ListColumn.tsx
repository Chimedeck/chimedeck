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
import type { ListSortBy } from '../../types';

type ListTextTone = 'light' | 'dark';

function getListTextTone(listColor: string | null): ListTextTone {
  if (!listColor || !/^#[0-9A-Fa-f]{6}$/.test(listColor)) return 'dark';
  const r = Number.parseInt(listColor.slice(1, 3), 16);
  const g = Number.parseInt(listColor.slice(3, 5), 16);
  const b = Number.parseInt(listColor.slice(5, 7), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.55 ? 'light' : 'dark';
}

interface Props {
  list: List;
  listColor?: string | null;
  availableLists?: Array<{ id: string; title: string }>;
  cardIds: string[];
  cards: Record<string, Card>;
  boardId?: string;
  boardTitle?: string;
  onRename: (listId: string, title: string) => void;
  onCopyList: (listId: string) => void;
  onMoveList: (listId: string, targetIndex: number) => void;
  onMoveAllCards: (listId: string, targetListId: string) => void;
  onArchive: (listId: string) => void;
  onArchiveAllCards: (listId: string) => void;
  onDelete: (listId: string) => void;
  onChangeListColor: (listId: string, color: string | null) => void;
  onSortBy: (listId: string, sortBy: ListSortBy) => void;
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
  hydration?: { loading: boolean; error: boolean };
}

const EMPTY_CUSTOM_FIELD_VALUES: CustomFieldValue[] = [];

const SortableListColumn = ({
  list,
  listColor = null,
  availableLists = [],
  cardIds,
  cards,
  boardId,
  boardTitle,
  onRename,
  onCopyList,
  onMoveList,
  onMoveAllCards,
  onArchive,
  onArchiveAllCards,
  onDelete,
  onChangeListColor,
  onSortBy,
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
  hydration,
}: Props) => {
  const [addingCard, setAddingCard] = useState(false);
  // WHY: stable noop so CardItem (memo'd) doesn't re-render when onToggleLabels
  // is not provided. An inline `() => {}` creates a new reference every render.
  const noopRef = useRef(() => {});
  const stableToggleLabels = useCallback(
    onToggleLabels ?? noopRef.current,
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

  const listTextTone = useMemo(() => getListTextTone(listColor), [listColor]);
  const listTextColor = listTextTone === 'light' ? '#FFFFFF' : '#111111';
  const style = useMemo<React.CSSProperties>(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      contentVisibility: 'auto',
      contain: 'layout paint style',
      containIntrinsicSize: '1px 640px',
      ...(listColor ? { backgroundColor: listColor, color: listTextColor } : {}),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transform?.x, transform?.y, transform?.scaleX, transform?.scaleY, transition, isDragging, listColor, listTextColor],
  );
  const columnBorderClass = listColor ? 'border-transparent' : 'border-border';
  const columnSurfaceClass = (() => {
    if (listColor) return '';
    if (hasBackground) return 'bg-bg-surface';
    return 'bg-bg-surface/90 backdrop-blur-sm';
  })();
  const loadingTextClass = (() => {
    if (!listColor) return 'text-muted';
    return listTextTone === 'light' ? 'text-white/80' : 'text-black/70';
  })();
  const addCardButtonToneClass = (() => {
    if (!listColor) return '';
    return listTextTone === 'light'
      ? 'text-white hover:bg-white/15 hover:text-white'
      : 'text-black hover:bg-black/10 hover:text-black';
  })();

  // WHY: in normal drag mode we keep the active item in the sortable collection
  // so dnd-kit can animate sibling displacement (clear push/drop indicator).
  // In placeholder mode we remove it to avoid rendering a double gap.
  const usePlaceholderMode =
    typeof dragPlaceholderIndex === 'number' && Number.isFinite(dragPlaceholderIndex);
  const visibleCardIds = useMemo(() => {
    if (!usePlaceholderMode || !activeDragCardId) return cardIds;
    const filtered = cardIds.filter((id) => id !== activeDragCardId);
    return filtered.length === cardIds.length ? cardIds : filtered;
  }, [activeDragCardId, cardIds, usePlaceholderMode]);
  const listCardObjects = useMemo(
    () => visibleCardIds
      .map((id) => cards[id])
      .filter((c): c is Card => c !== undefined),
    [visibleCardIds, cards],
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
      className={`w-72 shrink-0 border rounded-xl flex flex-col h-full ${columnBorderClass} ${columnSurfaceClass}`}
      role="listitem"
      aria-label={`List: ${list.title}`}
    >
      {/* Drag handle is the list header */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <ListHeader
          list={list}
          listColor={listColor}
          availableLists={availableLists}
          cardCount={cardIds.length}
          onRename={(title) => { onRename(list.id, title); }}
          onAddCard={() => { setAddingCard(true); }}
          onCopyList={() => { onCopyList(list.id); }}
          onMoveList={(targetIndex: number) => { onMoveList(list.id, targetIndex); }}
          onMoveAllCards={(targetListId: string) => { onMoveAllCards(list.id, targetListId); }}
          onArchive={() => { onArchive(list.id); }}
          onArchiveAllCards={() => { onArchiveAllCards(list.id); }}
          onDelete={() => { onDelete(list.id); }}
          onChangeListColor={(color: string | null) => { onChangeListColor(list.id, color); }}
          onSortBy={(sortBy: ListSortBy) => { onSortBy(list.id, sortBy); }}
          textTone={listTextTone}
          hasBackground={hasBackground}
        />
      </div>

      {/* Cards — vertically sortable */}
      <div
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 py-2 min-h-[2rem]"
        style={{ contentVisibility: 'auto', contain: 'layout paint style', containIntrinsicSize: '1px 900px' }}
      >
        <SortableContext items={visibleCardIds} strategy={verticalListSortingStrategy}>
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
        {hydration?.loading && (
          <p className={`mb-2 px-2 text-xs ${loadingTextClass}`}>Loading more cards...</p>
        )}
        {!isViewerGuest && (addingCard ? (
          <AddCardForm
            listId={list.id}
            onSubmit={async (listId, title) => {
              await onAddCard(listId, title);
              setAddingCard(false);
            }}
            onCancel={() => { setAddingCard(false); }}
          />
        ) : (
          <Button
            variant="ghost"
            className={`w-full justify-start rounded-lg px-2 py-1.5 text-sm ${addCardButtonToneClass}`}
            onClick={() => { setAddingCard(true); }}
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
  if (prev === next) return true;

  if (prev.list !== next.list) return false;
  if (prev.cardIds.length !== next.cardIds.length) return false;

  const hasSameCardsForList =
    prev.cardIds.every((cardId, index) => {
      if (next.cardIds[index] !== cardId) return false;
      return prev.cards[cardId] === next.cards[cardId];
    });

  return hasSameCardsForList
    && prev.boardId === next.boardId
    && prev.boardTitle === next.boardTitle
    && prev.onRename === next.onRename
    && prev.onCopyList === next.onCopyList
    && prev.onMoveList === next.onMoveList
    && prev.onMoveAllCards === next.onMoveAllCards
    && prev.onArchive === next.onArchive
    && prev.onArchiveAllCards === next.onArchiveAllCards
    && prev.onDelete === next.onDelete
    && prev.onChangeListColor === next.onChangeListColor
    && prev.onSortBy === next.onSortBy
    && prev.onAddCard === next.onAddCard
    && prev.onCardClick === next.onCardClick
    && prev.labelsExpanded === next.labelsExpanded
    && prev.onToggleLabels === next.onToggleLabels
    && prev.customFieldValuesMap === next.customFieldValuesMap
    && prev.listColor === next.listColor
    && prev.availableLists === next.availableLists
    && prev.isViewerGuest === next.isViewerGuest
    && prev.hasBackground === next.hasBackground
    && prev.dragPlaceholderIndex === next.dragPlaceholderIndex
    && prev.dragPlaceholderHeight === next.dragPlaceholderHeight
    && prev.activeDragCardId === next.activeDragCardId
    && prev.hydration?.loading === next.hydration?.loading
    && prev.hydration?.error === next.hydration?.error;
}

export default memo(SortableListColumn, areEqual);
