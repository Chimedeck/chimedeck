// Textarea with @mention autocomplete support.
// Drop-in replacement for a bare <textarea>; accepts boardId to scope suggestions.
import { useState } from 'react';
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
}: Props) => {
  const {
    textareaRef,
    suggestions,
    showSuggestions,
    highlightedIndex,
    suggestionPos,
    handleKeyDown,
    handleChange,
    selectSuggestion,
    dismissSuggestions,
  } = useMentionInput({ boardId, value, onChange });

  const [localHighlight, setLocalHighlight] = useState(0);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        className={className}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={dismissSuggestions}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={showSuggestions}
      />
      {showSuggestions && (
        <MentionSuggestions
          suggestions={suggestions}
          highlightedIndex={highlightedIndex}
          position={suggestionPos}
          onSelect={selectSuggestion}
          onHighlight={setLocalHighlight}
        />
      )}
    </div>
  );
};

export default MentionInput;
