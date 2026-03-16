// Textarea with @mention autocomplete support.
// Drop-in replacement for a bare <textarea>; accepts boardId to scope suggestions.
// Auto-resizes to fit content so the full text is always visible without inner scrolling.
import { useState, useEffect } from 'react';
import { useMentionInput } from './useMentionInput';
import MentionSuggestions from './MentionSuggestions';

interface Props {
  boardId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
  'aria-label'?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  autoFocus?: boolean;
}

const MentionInput = ({
  boardId,
  value,
  onChange,
  placeholder,
  className,
  rows = 3,
  disabled = false,
  'aria-label': ariaLabel,
  onKeyDown: externalKeyDown,
  autoFocus,
}: Props) => {
  const {
    textareaRef,
    suggestions,
    showSuggestions,
    highlightedIndex,
    handleKeyDown,
    handleChange,
    selectSuggestion,
    dismissSuggestions,
  } = useMentionInput({ boardId, value, onChange });

  const [localHighlight, setLocalHighlight] = useState(0);

  // Auto-resize: expand the textarea to show all content without internal scrolling
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          externalKeyDown?.(e);
          handleKeyDown(e);
        }}
        onBlur={dismissSuggestions}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={showSuggestions}
        style={{ overflow: 'hidden' }}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
      />
      {showSuggestions && (
        <MentionSuggestions
          suggestions={suggestions}
          highlightedIndex={highlightedIndex}
          onSelect={selectSuggestion}
          onHighlight={setLocalHighlight}
        />
      )}
    </div>
  );
};

export default MentionInput;
