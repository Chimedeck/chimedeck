// CardItem — draggable card chip using @dnd-kit/sortable useSortable.
// Styled per sprint-18 spec §4.
import { memo, useCallback, useMemo } from 'react';
import { CalendarIcon, ChatBubbleLeftIcon, PaperClipIcon, QueueListIcon, RectangleStackIcon } from '@heroicons/react/24/outline';
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

interface CardItemContentProps {
  card: Card;
  labelsExpanded: boolean;
  onToggleLabels?: () => void;
  listTitle?: string;
  boardTitle?: string;
  boardId?: string;
  customFieldValues?: CustomFieldValue[];
  currentUserId: string;
  onRemoveMember: (cardId: string, memberId: string) => Promise<void>;
}

function getDuePillClass(done: boolean, overdue: boolean, dueSoon: boolean): string {
  if (done) return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30';
  if (overdue) return 'text-red-700 dark:text-danger bg-red-50 dark:bg-red-900/30';
  if (dueSoon) return 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30';
  return 'text-muted';
}

const CardItemContent = memo(({
  card,
  labelsExpanded,
  onToggleLabels,
  listTitle,
  boardTitle,
  boardId,
  customFieldValues,
  currentUserId,
  onRemoveMember,
}: CardItemContentProps) => {
  const labels = card.labels ?? [];
  const members = card.members ?? [];
  const hasCover = Boolean(card.cover_image_url || card.cover_color);
  const coverHeightClass = card.cover_size === 'FULL' ? 'h-28' : 'h-20';

  const hasChecklist = (card.checklist_total ?? 0) > 0;
  const checklistDone = card.checklist_done ?? 0;
  const checklistTotal = card.checklist_total ?? 0;
  const checklistComplete = checklistDone === checklistTotal;

  const hasBadges =
    card.description ||
    card.due_date ||
    (card.comment_count ?? 0) > 0 ||
    (card.attachment_count ?? 0) > 0 ||
    (card.linked_card_count ?? 0) > 0 ||
    hasChecklist;

  return (
    <>
      {hasCover && (
        <div
          className={`w-full ${coverHeightClass}`}
          style={card.cover_image_url
            ? undefined
            : { backgroundColor: card.cover_color ?? '#334155' }}
        >
          {card.cover_image_url && (
            <img
              src={card.cover_image_url}
              alt="Card cover"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          )}
        </div>
      )}

      <div className="p-2.5">
        {labels.length > 0 && (
          <CardLabelChips
            labels={labels}
            expanded={labelsExpanded}
            onToggle={onToggleLabels ?? (() => {})}
          />
        )}
        <p className="text-base text-sm leading-snug break-words">{card.title}</p>
        {card.amount && (
          <div className="mt-1">
            <CardMoneyBadge amount={card.amount} currency={card.currency} />
          </div>
        )}
        {hasBadges && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {card.due_date && (() => {
              const now = Date.now();
              const due = new Date(card.due_date).getTime();
              const done = card.due_complete;
              const overdue = !done && due < now;
              const dueSoon = !done && !overdue && due - now < 24 * 60 * 60 * 1000;
              return (
                <span className={`inline-flex items-center gap-0.5 rounded px-1 text-xs ${getDuePillClass(done, overdue, dueSoon)}`}>
                  <CalendarIcon className="h-3 w-3 shrink-0" />
                  {new Date(card.due_date).toLocaleDateString()}
                </span>
              );
            })()}

            {hasChecklist && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs ${
                  checklistComplete
                    ? 'text-emerald-800 dark:text-emerald-400'
                    : 'text-muted'
                }`}
                title={`Checklist: ${checklistDone}/${checklistTotal}`}
              >
                <QueueListIcon className="h-3 w-3 shrink-0" />
                {checklistDone}/{checklistTotal}
              </span>
            )}

            {(card.attachment_count ?? 0) > 0 && (
              <span
                className="inline-flex items-center gap-0.5 text-xs text-muted"
                title={`${card.attachment_count} attachment${(card.attachment_count ?? 0) > 1 ? 's' : ''}`}
              >
                <PaperClipIcon className="h-3 w-3 shrink-0" />
                {card.attachment_count}
              </span>
            )}

            {(card.linked_card_count ?? 0) > 0 && (
              <span
                className="inline-flex items-center gap-0.5 text-xs text-muted"
                title={`${card.linked_card_count} linked card${(card.linked_card_count ?? 0) > 1 ? 's' : ''}`}
              >
                <RectangleStackIcon className="h-3 w-3 shrink-0" />
                {card.linked_card_count}
              </span>
            )}

            {(card.comment_count ?? 0) > 0 && (
              <span
                className="inline-flex items-center gap-0.5 text-xs text-muted"
                title={`${card.comment_count} comment${(card.comment_count ?? 0) > 1 ? 's' : ''}`}
              >
                <ChatBubbleLeftIcon className="h-3 w-3 shrink-0" />
                {card.comment_count}
              </span>
            )}
          </div>
        )}
        {members.length > 0 && (
          <div className="mt-1.5">
            <CardMemberAvatars
              members={members}
              cardId={card.id}
              currentUserId={currentUserId}
              onRemoveMember={onRemoveMember}
            />
          </div>
        )}
        <CardPluginBadges
          cardId={card.id}
          listId={card.list_id}
          cardTitle={card.title}
          {...(typeof listTitle === 'string' ? { listTitle } : {})}
          {...(typeof boardTitle === 'string' ? { boardTitle } : {})}
        />
        {boardId && customFieldValues && (
          <CardCustomFieldBadges boardId={boardId} values={customFieldValues} />
        )}
      </div>
    </>
  );
});

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-bg-surface hover:bg-bg-overlay border border-border rounded-lg overflow-hidden cursor-pointer transition-colors shrink-0${
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
      <CardItemContent
        card={card}
        labelsExpanded={labelsExpanded}
        {...(onToggleLabels ? { onToggleLabels } : {})}
        {...(typeof listTitle === 'string' ? { listTitle } : {})}
        {...(typeof boardTitle === 'string' ? { boardTitle } : {})}
        {...(typeof boardId === 'string' ? { boardId } : {})}
        {...(customFieldValues ? { customFieldValues } : {})}
        currentUserId={currentUser?.id ?? ''}
        onRemoveMember={handleRemoveMember}
      />
    </div>
  );
};

// WHY: memo prevents re-renders when parent re-renders with the same props.
// Without this every optimistic card-move update causes every CardItem to
// re-render, DnDKit re-measures all of them, and we spin into an update loop.
export default memo(CardItem);
