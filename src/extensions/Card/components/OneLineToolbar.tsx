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
  NumberedListIcon,
  ChatBubbleLeftEllipsisIcon,
  CodeBracketIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

interface Props {
  editor: Editor | null;
  overflowOpen: boolean;
  onToggleOverflow: () => void;
}

const OneLineToolbar = ({ editor, overflowOpen, onToggleOverflow }: Props) => {
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
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-1 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <button
              type="button"
              role="menuitem"
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800 ${editor?.isActive('orderedList') ? 'font-semibold text-indigo-600 dark:text-indigo-300' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                editor?.chain().focus().toggleOrderedList().run();
                onToggleOverflow();
              }}
            >
              <NumberedListIcon className="h-3.5 w-3.5 shrink-0" />
              Numbered list
            </button>
            <button
              type="button"
              role="menuitem"
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800 ${editor?.isActive('blockquote') ? 'font-semibold text-indigo-600 dark:text-indigo-300' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                editor?.chain().focus().toggleBlockquote().run();
                onToggleOverflow();
              }}
            >
              <ChatBubbleLeftEllipsisIcon className="h-3.5 w-3.5 shrink-0" />
              Quote
            </button>
            <button
              type="button"
              role="menuitem"
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800 ${editor?.isActive('codeBlock') ? 'font-semibold text-indigo-600 dark:text-indigo-300' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                editor?.chain().focus().toggleCodeBlock().run();
                onToggleOverflow();
              }}
            >
              <CodeBracketIcon className="h-3.5 w-3.5 shrink-0" />
              Code block
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OneLineToolbar;
