// CardItem — draggable card chip using @dnd-kit/core useDraggable.
// Styled per sprint-18 spec §4.
import { memo, useCallback, useMemo } from 'react';
import { CalendarIcon, ChatBubbleLeftIcon, PaperClipIcon, QueueListIcon, RectangleStackIcon } from '@heroicons/react/24/outline';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Card } from '../api';
import { removeMember } from '../api';
import apiClient from '~/common/api/client';
import CardLabelChips from './CardLabelChips';
import { CardMemberAvatars } from './CardMemberAvatars';
import CardMoneyBadge from './CardMoneyBadge';
import CardPluginBadges from '../../Plugins/uiInjections/CardPluginBadges';
import CardCustomFieldBadges from './CardCustomFieldBadges';

import type { CustomFieldValue } from '../../CustomFields/types';

const CARD_ITEM_SHADOW = [
  '0 3px 8px 0 rgba(0, 0, 0, 0.05)',
  '0 10px 15px 0 rgba(0, 0, 0, 0.04)',
  '0 23px 20px 0 rgba(0, 0, 0, 0.03)',
  '0 42px 24px 0 rgba(0, 0, 0, 0.01)',
  '0 65px 26px 0 rgba(0, 0, 0, 0)',
].join(', ');

export interface CardItemProps {
  card: Card;
  isOverlay?: boolean;
  onClick?: (cardId: string) => void;
  labelsExpanded?: boolean;
  onToggleLabels?: () => void;
  listTitle?: string;
  boardTitle?: string;
  boardId?: string;
  /** Current user id is threaded from BoardPage to avoid per-card store subscriptions. */
  currentUserId?: string;
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

function hasSameCustomFieldValues(
  prevValues: CustomFieldValue[] | undefined,
  nextValues: CustomFieldValue[] | undefined,
): boolean {
  if (prevValues === nextValues) return true;
  if (!prevValues || !nextValues) return false;
  if (prevValues.length !== nextValues.length) return false;

  for (let i = 0; i < prevValues.length; i += 1) {
    const prevValue = prevValues[i];
    const nextValue = nextValues[i];
    if (!prevValue || !nextValue) return false;
    if (
      prevValue.id !== nextValue.id
      || prevValue.custom_field_id !== nextValue.custom_field_id
      || prevValue.value_text !== nextValue.value_text
      || prevValue.value_number !== nextValue.value_number
      || prevValue.value_date !== nextValue.value_date
      || prevValue.value_checkbox !== nextValue.value_checkbox
      || prevValue.value_option_id !== nextValue.value_option_id
    ) {
      return false;
    }
  }

  return true;
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
  const labels = Array.isArray(card.labels) ? card.labels : [];
  const members = Array.isArray(card.members) ? card.members : [];
  const hasCover = Boolean(card.cover_image_url || card.cover_color);
  const selectedCoverSize = card.cover_size ?? 'SMALL';
  const useBackgroundImageMode = hasCover && selectedCoverSize === 'SMALL';
  // WHY: image covers should render at full card width and keep their original ratio.
  // Color-only covers keep the fixed strip height from cover_size.
  let coverClass = 'h-20';
  if (!card.cover_image_url && card.cover_size === 'FULL') {
    coverClass = 'h-28';
  }

  const hasChecklist = (card.checklist_total ?? 0) > 0;
  const checklistDone = card.checklist_done ?? 0;
  const checklistTotal = card.checklist_total ?? 0;
  const checklistComplete = checklistDone === checklistTotal;
  let checklistTextClass = 'text-muted';
  if (useBackgroundImageMode) {
    checklistTextClass = 'text-white';
  } else if (checklistComplete) {
    checklistTextClass = 'text-emerald-800 dark:text-emerald-400';
  }
  const attachmentCount = card.attachment_count ?? 0;
  const linkedCardCount = card.linked_card_count ?? 0;
  const commentCount = card.comment_count ?? 0;

  const hasBadges =
    card.description ||
    card.due_date ||
    commentCount > 0 ||
    attachmentCount > 0 ||
    linkedCardCount > 0 ||
    hasChecklist;

  const contentBlock = (
    <>
      {labels.length > 0 && (
        <CardLabelChips
          labels={labels}
          expanded={labelsExpanded}
          onToggle={onToggleLabels ?? (() => {})}
        />
      )}
      <p className={`text-sm leading-snug break-words ${useBackgroundImageMode ? 'text-white' : 'text-base'}`}>{card.title}</p>
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
            let dueClass = getDuePillClass(done, overdue, dueSoon);
            if (useBackgroundImageMode) {
              dueClass = 'text-white bg-black/45';
            }
            return (
              <span className={`inline-flex items-center gap-0.5 rounded px-1 text-xs ${dueClass}`}>
                <CalendarIcon className="h-3 w-3 shrink-0" />
                {new Date(card.due_date).toLocaleDateString()}
              </span>
            );
          })()}

          {hasChecklist && (
            <span
              className={`inline-flex items-center gap-0.5 text-xs ${checklistTextClass}`}
              title={`Checklist: ${String(checklistDone)}/${String(checklistTotal)}`}
            >
              <QueueListIcon className="h-3 w-3 shrink-0" />
              {checklistDone}/{checklistTotal}
            </span>
          )}

          {attachmentCount > 0 && (
            <span
              className={`inline-flex items-center gap-0.5 text-xs ${useBackgroundImageMode ? 'text-white/90' : 'text-muted'}`}
              title={`${String(attachmentCount)} attachment${attachmentCount > 1 ? 's' : ''}`}
            >
              <PaperClipIcon className="h-3 w-3 shrink-0" />
              {attachmentCount}
            </span>
          )}

          {linkedCardCount > 0 && (
            <span
              className={`inline-flex items-center gap-0.5 text-xs ${useBackgroundImageMode ? 'text-white/90' : 'text-muted'}`}
              title={`${String(linkedCardCount)} linked card${linkedCardCount > 1 ? 's' : ''}`}
            >
              <RectangleStackIcon className="h-3 w-3 shrink-0" />
              {linkedCardCount}
            </span>
          )}

          {commentCount > 0 && (
            <span
              className={`inline-flex items-center gap-0.5 text-xs ${useBackgroundImageMode ? 'text-white/90' : 'text-muted'}`}
              title={`${String(commentCount)} comment${commentCount > 1 ? 's' : ''}`}
            >
              <ChatBubbleLeftIcon className="h-3 w-3 shrink-0" />
              {commentCount}
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
    </>
  );

  return (
    <>
      {hasCover && !useBackgroundImageMode && (
        <div
          className={`w-full overflow-hidden ${card.cover_image_url ? '' : coverClass}`}
          style={card.cover_image_url
            ? undefined
            : { backgroundColor: card.cover_color ?? '#334155' }}
        >
          {card.cover_image_url && (
            <img
              src={card.cover_image_url}
              alt="Card cover"
              className="block w-full h-auto"
              loading="lazy"
            />
          )}
        </div>
      )}

      {useBackgroundImageMode ? (
        <div className="relative">
          {card.cover_image_url ? (
            <>
              <img
                src={card.cover_image_url}
                alt="Card cover"
                className="block w-full h-auto"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/28" aria-hidden="true" />
            </>
          ) : (
            <div
              className="w-full min-h-[112px]"
              style={{ backgroundColor: card.cover_color ?? '#334155' }}
              aria-hidden="true"
            />
          )}
          <div className="absolute inset-0 overflow-hidden p-2.5 text-white flex items-end">
            <div className="w-full">
              {contentBlock}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-2.5">
          {contentBlock}
        </div>
      )}
    </>
  );
}, (prev, next) => {
  if (prev === next) return true;
  if (prev.labelsExpanded !== next.labelsExpanded) return false;
  if (prev.onToggleLabels !== next.onToggleLabels) return false;
  if (prev.listTitle !== next.listTitle) return false;
  if (prev.boardTitle !== next.boardTitle) return false;
  if (prev.boardId !== next.boardId) return false;
  if (prev.currentUserId !== next.currentUserId) return false;
  if (prev.onRemoveMember !== next.onRemoveMember) return false;
  if (!hasSameCustomFieldValues(prev.customFieldValues, next.customFieldValues)) return false;

  const prevCard = prev.card;
  const nextCard = next.card;
  if (prevCard === nextCard) return true;

  return prevCard.id === nextCard.id
    && prevCard.title === nextCard.title
    && prevCard.list_id === nextCard.list_id
    && prevCard.cover_image_url === nextCard.cover_image_url
    && prevCard.cover_color === nextCard.cover_color
    && prevCard.cover_size === nextCard.cover_size
    && prevCard.description === nextCard.description
    && prevCard.due_date === nextCard.due_date
    && prevCard.due_complete === nextCard.due_complete
    && prevCard.amount === nextCard.amount
    && prevCard.currency === nextCard.currency
    && prevCard.checklist_total === nextCard.checklist_total
    && prevCard.checklist_done === nextCard.checklist_done
    && prevCard.attachment_count === nextCard.attachment_count
    && prevCard.linked_card_count === nextCard.linked_card_count
    && prevCard.comment_count === nextCard.comment_count
    && prevCard.labels === nextCard.labels
    && prevCard.members === nextCard.members;
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
  currentUserId = '',
  customFieldValues,
}: CardItemProps) => {
  const selectedCoverSize = card.cover_size ?? 'SMALL';
  const hasImageCover = Boolean(card.cover_image_url);
  const useBackgroundImageMode = Boolean(card.cover_image_url) && selectedCoverSize === 'SMALL';

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: card.id,
      disabled: isOverlay,
    });

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
      transform: CSS.Translate.toString(transform),
      opacity: isDragging && !isOverlay ? 0 : 1,
      boxShadow: isOverlay ? undefined : CARD_ITEM_SHADOW,
      willChange: transform ? 'transform' : undefined,
    }),
    [transform?.x, transform?.y, isDragging, isOverlay],
  );

  let surfaceClass = 'bg-bg-surface hover:bg-bg-overlay border-border';
  if (useBackgroundImageMode) {
    surfaceClass = 'bg-transparent hover:bg-transparent border-transparent';
  }
  const borderClass = hasImageCover ? '' : 'border';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-dnd-card-id={card.id}
      className={`${surfaceClass} ${borderClass} rounded-lg overflow-hidden cursor-pointer transition-colors shrink-0${
        isOverlay ? ' rotate-2 scale-105 shadow-2xl opacity-90 pointer-events-none' : ''
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
        currentUserId={currentUserId}
        onRemoveMember={handleRemoveMember}
      />
    </div>
  );
};

function areCardItemPropsEqual(prev: CardItemProps, next: CardItemProps): boolean {
  if (prev === next) return true;
  if (prev.isOverlay !== next.isOverlay) return false;
  if (prev.onClick !== next.onClick) return false;
  if (prev.labelsExpanded !== next.labelsExpanded) return false;
  if (prev.onToggleLabels !== next.onToggleLabels) return false;
  if (prev.listTitle !== next.listTitle) return false;
  if (prev.boardTitle !== next.boardTitle) return false;
  if (prev.boardId !== next.boardId) return false;
  if (prev.currentUserId !== next.currentUserId) return false;
  if (!hasSameCustomFieldValues(prev.customFieldValues, next.customFieldValues)) return false;

  const prevCard = prev.card;
  const nextCard = next.card;
  if (prevCard === nextCard) return true;

  return prevCard.id === nextCard.id
    && prevCard.title === nextCard.title
    && prevCard.list_id === nextCard.list_id
    && prevCard.cover_image_url === nextCard.cover_image_url
    && prevCard.cover_color === nextCard.cover_color
    && prevCard.cover_size === nextCard.cover_size
    && prevCard.description === nextCard.description
    && prevCard.due_date === nextCard.due_date
    && prevCard.due_complete === nextCard.due_complete
    && prevCard.amount === nextCard.amount
    && prevCard.currency === nextCard.currency
    && prevCard.checklist_total === nextCard.checklist_total
    && prevCard.checklist_done === nextCard.checklist_done
    && prevCard.attachment_count === nextCard.attachment_count
    && prevCard.linked_card_count === nextCard.linked_card_count
    && prevCard.comment_count === nextCard.comment_count
    && prevCard.labels === nextCard.labels
    && prevCard.members === nextCard.members;
}

// WHY: memo prevents re-renders when parent re-renders with the same props.
// Without this every optimistic card-move update causes every CardItem to
// re-render, DnDKit re-measures all of them, and we spin into an update loop.
export default memo(CardItem, areCardItemPropsEqual);
