// Hook that manages @mention detection, debounced suggestion fetching,
// keyboard navigation, and insertion into a textarea.
import { useState, useRef, useCallback, useEffect } from 'react';
import apiClient from '../../api/client';

interface MentionSuggestion {
  id: string;
  nickname: string;
  name: string;
  avatar_url: string | null;
}

interface UseMentionInputOptions {
  boardId: string;
  value: string;
  onChange: (value: string) => void;
}

interface UseMentionInputResult {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  suggestions: MentionSuggestion[];
  showSuggestions: boolean;
  highlightedIndex: number;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  selectSuggestion: (suggestion: MentionSuggestion) => void;
  dismissSuggestions: () => void;
}

const DEBOUNCE_MS = 150;

export function useMentionInput({
  boardId,
  value,
  onChange,
}: UseMentionInputOptions): UseMentionInputResult {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [triggerStart, setTriggerStart] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setSuggestions([]);
    setTriggerStart(null);
  }, []);


  // Fetch suggestions from the server
  const fetchSuggestions = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          // apiClient auto-attaches the Bearer token and unwraps response.data
          const result = (await apiClient.get(
            `/boards/${boardId}/members/suggestions?q=${encodeURIComponent(query)}`,
          )) as { data: MentionSuggestion[] };
          if (result.data.length === 0) {
            dismissSuggestions();
          } else {
            setSuggestions(result.data);
            setShowSuggestions(true);
            setHighlightedIndex(0);
          }
        } catch {
          dismissSuggestions();
        }
      }, DEBOUNCE_MS);
    },
    [boardId, dismissSuggestions],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      const cursor = e.target.selectionStart ?? newValue.length;
      // Find the @-trigger word ending at cursor
      const textBefore = newValue.slice(0, cursor);
      const match = textBefore.match(/\B@([\w-]{0,50})$/);

      if (match) {
        const start = cursor - match[0].length;
        setTriggerStart(start);
        fetchSuggestions(match[1] ?? '');
      } else {
        dismissSuggestions();
      }
    },
    [onChange, fetchSuggestions, dismissSuggestions],
  );

  const selectSuggestion = useCallback(
    (suggestion: MentionSuggestion) => {
      if (triggerStart === null) return;

      const textarea = textareaRef.current;
      const cursor = textarea?.selectionStart ?? value.length;
      const before = value.slice(0, triggerStart);
      const after = value.slice(cursor);
      const newValue = `${before}@${suggestion.nickname} ${after}`;
      onChange(newValue);

      // Restore focus and position cursor after the inserted mention
      requestAnimationFrame(() => {
        if (textarea) {
          const newCursor = triggerStart + suggestion.nickname.length + 2; // '@' + nickname + ' '
          textarea.focus();
          textarea.setSelectionRange(newCursor, newCursor);
        }
      });

      dismissSuggestions();
    },
    [triggerStart, value, onChange, dismissSuggestions],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showSuggestions) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        const selected = suggestions[highlightedIndex];
        if (selected) {
          e.preventDefault();
          selectSuggestion(selected);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        dismissSuggestions();
      }
    },
    [showSuggestions, suggestions, highlightedIndex, selectSuggestion, dismissSuggestions],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    textareaRef,
    suggestions,
    showSuggestions,
    highlightedIndex,
    handleKeyDown,
    handleChange,
    selectSuggestion,
    dismissSuggestions,
  };
}
