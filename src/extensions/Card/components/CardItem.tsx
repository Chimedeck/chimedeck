// CardItem — draggable card chip using @dnd-kit/sortable useSortable.
// Styled per sprint-18 spec §4.
import { memo, useCallback, useMemo } from 'react';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSelector } from 'react-redux';
import type { Card } from '../api';
import { removeMember } from '../api';
import { selectCurrentUser } from '~/slices/authSlice';
import apiClient from '~/common/api/client';
import CardLabelChips from './CardLabelChips';
import { CardMemberAvatars } from './CardMemberAvatars';
import CardMoneyBadge from './CardMoneyBadge';
import CardPluginBadges from '../../Plugins/uiInjections/CardPluginBadges';
import CardCustomFieldBadges from './CardCustomFieldBadges';

import type { CustomFieldValue } from '../../CustomFields/types';

export interface CardItemProps {
  card: Card;
  isOverlay?: boolean;
  onClick?: (cardId: string) => void;
  labelsExpanded?: boolean;
  onToggleLabels?: () => void;
  listTitle?: string;
  boardTitle?: string;
  boardId?: string;
  /** Pre-fetched custom field values for this card from a board-level batch request. */
  customFieldValues?: CustomFieldValue[];
}

const CardItem = ({
  card,
  isOverlay = false,
  onClick,
  labelsExpanded = false,
  onToggleLabels,
  listTitle,
  boardTitle,
  boardId,
  customFieldValues,
}: CardItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const currentUser = useSelector(selectCurrentUser);
  const api = apiClient;

  const handleRemoveMember = useCallback(
    async (cardId: string, memberId: string) => {
      await removeMember({ api, cardId, userId: memberId });
    },
    [api],
  );

  // WHY: memoize the style object so its reference only changes when the values
  // actually change. A new object reference on every render causes DnDKit to
  // re-measure the element in a useEffect, which triggers setState, which
  // re-renders, which re-measures — infinite loop during rapid drags.
  const style = useMemo<React.CSSProperties>(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging && !isOverlay ? 0 : 1,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transform?.x, transform?.y, transform?.scaleX, transform?.scaleY, transition, isDragging, isOverlay],
  );

  const labels = card.labels ?? [];
  const members = card.members ?? [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700/50 rounded-lg p-2.5 cursor-pointer transition-colors${
        isOverlay ? ' rotate-2 scale-105 shadow-2xl opacity-90' : ''
      }`}
      role="button"
      tabIndex={0}
      aria-label={`Card: ${card.title}`}
      onClick={() => onClick?.(card.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.(card.id);
      }}
    >
      {labels.length > 0 && (
        <CardLabelChips
          labels={labels}
          expanded={labelsExpanded}
          onToggle={onToggleLabels ?? (() => {})}
        />
      )}
      <p className="text-gray-800 dark:text-slate-200 text-sm leading-snug break-words">{card.title}</p>
      {card.due_date && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          {new Date(card.due_date).toLocaleDateString()}
        </p>
      )}
      {card.amount && (
        <div className="mt-1">
          <CardMoneyBadge amount={card.amount} currency={card.currency} />
        </div>
      )}
      {members.length > 0 && (
        <div className="mt-1.5">
          <CardMemberAvatars
            members={members}
            cardId={card.id}
            currentUserId={currentUser?.id ?? ''}
            onRemoveMember={handleRemoveMember}
          />
        </div>
      )}
      <CardPluginBadges
        cardId={card.id}
        listId={card.list_id}
        cardTitle={card.title}
        listTitle={listTitle}
        boardTitle={boardTitle}
      />
      {boardId && (
        <CardCustomFieldBadges boardId={boardId} values={customFieldValues} />
      )}
    </div>
  );
};

// WHY: memo prevents re-renders when parent re-renders with the same props.
// Without this every optimistic card-move update causes every CardItem to
// re-render, DnDKit re-measures all of them, and we spin into an update loop.
export default memo(CardItem);
