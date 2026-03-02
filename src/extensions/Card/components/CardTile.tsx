// CardTile — compact card representation rendered inside a ListColumn.
import type { Card } from '../api';

interface Props {
  card: Card;
  onClick: (cardId: string) => void;
  dragHandleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
}

const CardTile = ({ card, onClick, dragHandleProps = {}, style }: Props) => {
  return (
    <div
      className={`group rounded bg-white px-3 py-2 shadow-sm cursor-pointer hover:bg-blue-50 transition-colors${card.archived ? ' opacity-60' : ''}`}
      style={style}
      onClick={() => onClick(card.id)}
      role="button"
      tabIndex={0}
      aria-label={`Card: ${card.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick(card.id);
      }}
      {...dragHandleProps}
    >
      {card.archived && (
        <span className="mb-1 inline-block rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700">
          Archived
        </span>
      )}
      <p className="text-sm font-medium text-gray-800 break-words">{card.title}</p>
      {card.due_date && (
        <p className="mt-1 text-xs text-gray-500">
          Due: {new Date(card.due_date).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};

export default CardTile;
