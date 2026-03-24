// CalendarCardChip — compact chip for a card in the calendar grid.
// Shows the card title and the first label's colour dot (if any).
// Draggable: sets the card id as drag data so CalendarDayCell can handle drops.
import translations from './translations/en.json';
import type { CalendarCardChipProps } from './types';

const CalendarCardChip = ({ card, onClick }: CalendarCardChipProps) => {
  const firstLabel = card.labels?.[0];

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData('text/plain', card.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <button
      draggable
      onDragStart={handleDragStart}
      onClick={() => onClick(card.id)}
      title={card.title}
      aria-label={`${translations['CalendarView.cardAriaPrefix']} ${card.title}`}
      data-testid={`calendar-chip-${card.id}`}
      className="flex w-full items-center gap-1 rounded bg-slate-700 px-1.5 py-0.5 text-left text-xs text-slate-100 hover:bg-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate cursor-grab active:cursor-grabbing"
    >
      {firstLabel && (
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: firstLabel.color }}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{card.title}</span>
    </button>
  );
};

export default CalendarCardChip;
