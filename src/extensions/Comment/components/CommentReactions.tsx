// CommentReactions — pill row displaying emoji reactions + add-reaction trigger.
import { useRef, useState } from 'react';
import type { ReactionSummary } from './CommentItem';
import EmojiPickerPopover from './EmojiPickerPopover';
import translations from '../translations/en.json';

interface Props {
  reactions: ReactionSummary[];
  onAdd: (emoji: string) => Promise<void>;
  onRemove: (emoji: string) => Promise<void>;
}

const CommentReactions = ({ reactions, onAdd, onRemove }: Props) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);

  const handlePillClick = async (reaction: ReactionSummary) => {
    if (reaction.reactedByMe) {
      await onRemove(reaction.emoji);
    } else {
      await onAdd(reaction.emoji);
    }
  };

  return (
    <div className="flex flex-wrap gap-1 items-center mt-1">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          onClick={() => void handlePillClick(reaction)}
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
      ))}

      {/* Add-reaction trigger */}
      <button
        ref={addButtonRef}
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        aria-label={translations['comment.reactions.add']}
        className="inline-flex items-center justify-center rounded-full border border-border bg-bg-overlay px-2 py-0.5 text-xs text-muted hover:text-base hover:bg-bg-sunken transition-colors cursor-pointer"
      >
        😀+
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
