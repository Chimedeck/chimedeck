// CardItem — draggable card chip using @dnd-kit/sortable useSortable.
// Styled per sprint-18 spec §4.
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card } from '../api';
import CardLabelChips from './CardLabelChips';
import { CardMemberAvatars } from './CardMemberAvatars';

export interface CardItemProps {
  card: Card;
  isOverlay?: boolean;
  onClick?: (cardId: string) => void;
  labelsExpanded?: boolean;
  onToggleLabels?: () => void;
}

const CardItem = ({ card, isOverlay = false, onClick, labelsExpanded = false, onToggleLabels }: CardItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Hide the original item while it is being dragged (overlay shows instead)
    opacity: isDragging && !isOverlay ? 0 : 1,
  };

  const labels = card.labels ?? [];
  const members = (card as unknown as { members?: { id: string; email: string; name: string | null }[] }).members ?? [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-slate-800 hover:bg-slate-700 border border-slate-700/50 rounded-lg p-2.5 cursor-pointer transition-colors${
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
      <p className="text-slate-200 text-sm leading-snug break-words">{card.title}</p>
      {card.due_date && (
        <p className="mt-1 text-xs text-slate-500">
          📅 {new Date(card.due_date).toLocaleDateString()}
        </p>
      )}
      {members.length > 0 && (
        <div className="mt-1.5">
          <CardMemberAvatars members={members} currentUserId="" />
        </div>
      )}
    </div>
  );
};

export default CardItem;

