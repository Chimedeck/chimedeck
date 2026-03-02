// VirtualCardList — virtualized card column for boards with > 100 cards.
// Uses @tanstack/react-virtual to render only visible cards, keeping the DOM lean.
// Install: bun add @tanstack/react-virtual
import { useRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VirtualizerRow = { key: string; index: number; start: number; size: number };

interface Card {
  id: string;
  title: string;
  [key: string]: unknown;
}

interface Props {
  cards: Card[];
  renderCard: (card: Card, index: number) => React.ReactNode;
  estimatedCardHeight?: number;
}

const DIRECT_RENDER_THRESHOLD = 100;

// Lazy-loaded virtualizer to avoid importing @tanstack/react-virtual at module load
// when the card count is below the threshold (common case).
const VirtualCardList = ({ cards, renderCard, estimatedCardHeight = 80 }: Props) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // Below threshold: render directly for simplicity.
  if (cards.length <= DIRECT_RENDER_THRESHOLD) {
    return (
      <div className="flex flex-col gap-2">
        {cards.map((card, i) => (
          <div key={card.id}>{renderCard(card, i)}</div>
        ))}
      </div>
    );
  }

  // Above threshold: use @tanstack/react-virtual.
  // The import is inside the component so the module is code-split.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useVirtualizer } = require('@tanstack/react-virtual');

  // eslint-disable-next-line react-hooks/rules-of-hooks -- conditional only on count, never changes
  const virtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedCardHeight,
    overscan: 5,
  });

  const items: VirtualizerRow[] = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="overflow-y-auto"
      style={{ maxHeight: '75vh' }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {items.map((row) => (
          <div
            key={row.key}
            style={{
              position: 'absolute',
              top: 0,
              transform: `translateY(${row.start}px)`,
              width: '100%',
              paddingBottom: '8px',
            }}
          >
            {renderCard(cards[row.index] as Card, row.index)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VirtualCardList;
