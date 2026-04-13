// ReactionExample — emoji reaction pill demo with toggle state.
// No API calls — purely local state.
import { useState } from 'react';
import { FaceSmileIcon } from '@heroicons/react/24/outline';

interface Reaction {
  emoji: string;
  label: string;
  count: number;
  active: boolean;
}

const INITIAL_REACTIONS: Reaction[] = [
  { emoji: '👍', label: 'thumbs up', count: 4, active: false },
  { emoji: '🎉', label: 'party popper', count: 2, active: true },
  { emoji: '❤️', label: 'heart', count: 6, active: false },
  { emoji: '😂', label: 'laughing', count: 1, active: false },
];

export default function ReactionExample() {
  const [reactions, setReactions] = useState<Reaction[]>(INITIAL_REACTIONS);

  const toggle = (emoji: string) => {
    setReactions((prev) =>
      prev.map((r) =>
        r.emoji === emoji
          ? { ...r, active: !r.active, count: r.active ? r.count - 1 : r.count + 1 }
          : r
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Reactions">
        {reactions.map((r) => (
          <button
            key={r.emoji}
            type="button"
            aria-label={`${r.label}: ${String(r.count)} reaction${r.count !== 1 ? 's' : ''}${r.active ? ', reacted' : ''}`}
            aria-pressed={r.active}
            onClick={() => { toggle(r.emoji); }}
            className={[
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border transition-colors',
              r.active
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-bg-subtle border-border text-text-secondary hover:border-border-strong hover:text-text-primary',
            ].join(' ')}
          >
            <span aria-hidden="true">{r.emoji}</span>
            <span className="font-medium tabular-nums">{r.count}</span>
          </button>
        ))}

        {/* Add reaction trigger */}
        <button
          type="button"
          aria-label="Add reaction"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border border-dashed border-border text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors"
        >
          <FaceSmileIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p className="text-xs text-text-secondary">
        Click a reaction pill to toggle. Active pills are highlighted with the primary colour.
      </p>
    </div>
  );
}
