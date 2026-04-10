// CommentReactions — pill row displaying emoji reactions + add-reaction trigger.
import { useRef, useState } from 'react';
import { FaceSmileIcon } from '@heroicons/react/24/outline';
import type { ReactionSummary } from './CommentItem';
import EmojiPickerPopover from './EmojiPickerPopover';
import translations from '../translations/en.json';

interface Props {
  reactions: ReactionSummary[];
  onAdd: (emoji: string) => Promise<void>;
  onRemove: (emoji: string) => Promise<void>;
  className?: string;
}

const CommentReactions = ({ reactions, onAdd, onRemove, className }: Props) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);

  const handlePillClick = async (reaction: ReactionSummary) => {
    if (reaction.reactedByMe) {
      await onRemove(reaction.emoji);
    } else {
      await onAdd(reaction.emoji);
    }
  };

  /** Build the tooltip label showing who reacted. */
  const buildTooltip = (reaction: ReactionSummary): string => {
    const reactors = reaction.reactors ?? [];
    if (reactors.length === 0) return `${reaction.count} reaction${reaction.count === 1 ? '' : 's'}`;
    const names = reactors.map((r) => r.name ?? 'Someone');
    if (names.length <= 3) return names.join(', ');
    const shown = names.slice(0, 3).join(', ');
    return `${shown} and ${names.length - 3} more`;
  };

  return (
    <div className={[
      'flex flex-wrap items-center gap-1',
      className ?? '',
    ].join(' ').trim()}>
      {reactions.map((reaction) => (
        <div key={reaction.emoji} className="relative">
          <button
            type="button"
            onClick={() => void handlePillClick(reaction)}
            onMouseEnter={() => setHoveredEmoji(reaction.emoji)}
            onMouseLeave={() => setHoveredEmoji(null)}
            aria-label={translations['comment.reactions.aria.pill']
              .replace('{{emoji}}', reaction.emoji)
              .replace('{{count}}', String(reaction.count))
              .replace('{{state}}', reaction.reactedByMe ? 'active' : 'inactive')}
            className={[
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs cursor-pointer select-none transition-colors',
              reaction.reactedByMe
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-bg-overlay border-border text-base hover:bg-bg-sunken',
            ].join(' ')}
          >
            <span>{reaction.emoji}</span>
            <span>{reaction.count}</span>
          </button>

          {/* Reactor tooltip */}
          {hoveredEmoji === reaction.emoji && (
            <div
              role="tooltip"
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none whitespace-nowrap rounded-lg bg-gray-900 dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-black/10"
            >
              {buildTooltip(reaction)}
              {/* Arrow */}
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
            </div>
          )}
        </div>
      ))}

      {/* Add-reaction trigger */}
      <button
        ref={addButtonRef}
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        aria-label={translations['comment.reactions.add']}
        className="inline-flex items-center gap-0.5 rounded-full border border-border bg-bg-overlay px-2 py-0.5 text-muted hover:text-base hover:bg-bg-sunken transition-colors cursor-pointer"
      >
        <FaceSmileIcon className="h-3.5 w-3.5" />
        <span className="text-xs leading-none">+</span>
      </button>

      {pickerOpen && (
        <EmojiPickerPopover
          anchorRef={addButtonRef as React.RefObject<HTMLElement | null>}
          onSelect={(emoji) => { void onAdd(emoji); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
};

export default CommentReactions;
