// Shared single-line rich-text toolbar for Tiptap editors.
// Primary formatting controls are always visible; secondary controls are hidden
// behind a + overflow button that never causes the bar to wrap.
import { useRef, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  ListBulletIcon,
  PlusIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline';
import CommandMenu from './CommandMenu';

interface Props {
  editor: Editor | null;
  overflowOpen: boolean;
  onToggleOverflow: () => void;
  /** When provided, a paperclip button appears in the toolbar to trigger file upload */
  onAttach?: () => void;
}

const OneLineToolbar = ({ editor, overflowOpen, onToggleOverflow, onAttach }: Props) => {
  const overflowRef = useRef<HTMLDivElement>(null);

  // Close overflow menu when clicking outside
  useEffect(() => {
    if (!overflowOpen) return;
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        onToggleOverflow();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overflowOpen, onToggleOverflow]);

  const runCmd = useCallback(
    (command: () => boolean) => (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      command();
    },
    [],
  );

  const btn =
    'p-1.5 text-xs rounded border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors';
  const btnActive = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200';

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="z-20 flex shrink-0 items-center gap-1 border-b border-gray-200 bg-white p-2 shadow-md dark:border-slate-700 dark:bg-slate-900"
    >
      {/* Primary controls — always visible */}
      <button
        type="button"
        aria-label="Bold"
        title="Bold"
        className={`${btn} ${editor?.isActive('bold') ? btnActive : ''}`}
        onMouseDown={runCmd(() => editor?.chain().focus().toggleBold().run() ?? false)}
      >
        <BoldIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Italic"
        title="Italic"
        className={`${btn} ${editor?.isActive('italic') ? btnActive : ''}`}
        onMouseDown={runCmd(() => editor?.chain().focus().toggleItalic().run() ?? false)}
      >
        <ItalicIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Strikethrough"
        title="Strikethrough"
        className={`${btn} ${editor?.isActive('strike') ? btnActive : ''}`}
        onMouseDown={runCmd(() => editor?.chain().focus().toggleStrike().run() ?? false)}
      >
        <StrikethroughIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Bullet list"
        title="Bullet list"
        className={`${btn} ${editor?.isActive('bulletList') ? btnActive : ''}`}
        onMouseDown={runCmd(() => editor?.chain().focus().toggleBulletList().run() ?? false)}
      >
        <ListBulletIcon className="h-3.5 w-3.5" />
      </button>

      {/* Attach file button — shown when caller provides onAttach handler */}
      {onAttach && (
        <button
          type="button"
          aria-label="Attach file"
          title="Attach file"
          className={btn}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAttach();
          }}
        >
          <PaperClipIcon className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Overflow + button — secondary controls */}
      <div ref={overflowRef} className="relative ml-auto">
        <button
          type="button"
          aria-label="More formatting options"
          title="More formatting options"
          aria-expanded={overflowOpen}
          aria-haspopup="menu"
          className={`${btn} ${overflowOpen ? btnActive : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleOverflow();
          }}
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>

        {overflowOpen && (
          <CommandMenu editor={editor} onClose={onToggleOverflow} />
        )}
      </div>
    </div>
  );
};

export default OneLineToolbar;
