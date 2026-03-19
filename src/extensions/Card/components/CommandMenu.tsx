// Searchable command menu for the + overflow button in rich text editors.
// Commands are filtered by label/keywords as the user types; selecting one
// executes immediately and closes the menu via onClose.
import { useState, useRef, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import {
  AtSymbolIcon,
  FaceSmileIcon,
  CodeBracketIcon,
  ChatBubbleLeftEllipsisIcon,
  NumberedListIcon,
} from '@heroicons/react/24/outline';

interface CommandDef {
  id: string;
  label: string;
  keywords: string[];
  icon: React.ReactNode;
  execute: (editor: Editor) => void;
}

interface Props {
  editor: Editor | null;
  onClose: () => void;
}

// Static command definitions — icons are pre-rendered so JSX can live here.
const COMMANDS: CommandDef[] = [
  {
    id: 'mention',
    label: 'Mention',
    keywords: ['@', 'mention', 'user', 'tag'],
    icon: <AtSymbolIcon className="h-3.5 w-3.5 shrink-0" />,
    execute: (editor) => {
      // Insert '@' trigger for mention flow; full mention extension deferred.
      editor.chain().focus().insertContent('@').run();
    },
  },
  {
    id: 'emoji',
    label: 'Emoji',
    keywords: ['emoji', 'smile', ':', 'reaction'],
    icon: <FaceSmileIcon className="h-3.5 w-3.5 shrink-0" />,
    execute: (editor) => {
      // Insert ':' trigger; full emoji picker deferred to a future iteration.
      editor.chain().focus().insertContent(':').run();
    },
  },
  {
    id: 'code-snippet',
    label: 'Code snippet',
    keywords: ['code', 'snippet', 'block', '```'],
    icon: <CodeBracketIcon className="h-3.5 w-3.5 shrink-0" />,
    execute: (editor) => {
      editor.chain().focus().toggleCodeBlock().run();
    },
  },
  {
    id: 'quote',
    label: 'Quote',
    keywords: ['quote', 'blockquote', '>'],
    icon: <ChatBubbleLeftEllipsisIcon className="h-3.5 w-3.5 shrink-0" />,
    execute: (editor) => {
      editor.chain().focus().toggleBlockquote().run();
    },
  },
  {
    id: 'numbered-list',
    label: 'Numbered list',
    keywords: ['numbered', 'list', 'ordered', '1.'],
    icon: <NumberedListIcon className="h-3.5 w-3.5 shrink-0" />,
    execute: (editor) => {
      editor.chain().focus().toggleOrderedList().run();
    },
  },
];

const matchesQuery = (cmd: CommandDef, query: string): boolean => {
  if (!query) return true;
  const q = query.toLowerCase();
  return cmd.label.toLowerCase().includes(q) || cmd.keywords.some((k) => k.toLowerCase().includes(q));
};

const CommandMenu = ({ editor, onClose }: Props) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = COMMANDS.filter((cmd) => matchesQuery(cmd, query));

  // Focus the search input immediately when the menu mounts.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Reset active index when filtered list changes so it never points out of bounds.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const executeCommand = useCallback(
    (cmd: CommandDef) => {
      if (editor) cmd.execute(editor);
      onClose();
    },
    [editor, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        const cmd = filtered[activeIndex];
        if (cmd) executeCommand(cmd);
        return;
      }
    },
    [activeIndex, filtered, executeCommand, onClose],
  );

  // Scroll active item into view when navigating with keyboard.
  useEffect(() => {
    const item = listRef.current?.querySelector<HTMLButtonElement>(`[data-index="${activeIndex}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const isActive = (cmd: CommandDef) =>
    (cmd.id === 'code-snippet' && editor?.isActive('codeBlock')) ||
    (cmd.id === 'quote' && editor?.isActive('blockquote')) ||
    (cmd.id === 'numbered-list' && editor?.isActive('orderedList'));

  return (
    <div
      role="menu"
      aria-label="Command menu"
      className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
      onKeyDown={handleKeyDown}
    >
      {/* Search input */}
      <div className="border-b border-gray-100 px-2 py-1.5 dark:border-slate-700">
        <input
          ref={searchRef}
          type="text"
          role="searchbox"
          aria-label="Search commands"
          placeholder="Search commands…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none dark:text-slate-200 dark:placeholder-slate-500"
        />
      </div>

      {/* Command list */}
      <div ref={listRef} className="max-h-48 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-400 dark:text-slate-500">No matching commands</p>
        ) : (
          filtered.map((cmd, idx) => (
            <button
              key={cmd.id}
              type="button"
              role="menuitem"
              data-index={idx}
              aria-selected={idx === activeIndex}
              className={[
                'flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors',
                idx === activeIndex
                  ? 'bg-gray-100 dark:bg-slate-800'
                  : 'hover:bg-gray-50 dark:hover:bg-slate-800/50',
                isActive(cmd)
                  ? 'font-semibold text-indigo-600 dark:text-indigo-300'
                  : 'text-gray-700 dark:text-slate-200',
              ].join(' ')}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseDown={(e) => {
                // Prevent editor blur so focus returns after command.
                e.preventDefault();
                executeCommand(cmd);
              }}
            >
              {cmd.icon}
              {cmd.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default CommandMenu;
