// Shared single-line rich-text toolbar for Tiptap editors.
// Primary formatting controls are always visible; secondary controls are hidden
// behind a + overflow button that never causes the bar to wrap.
import { useRef, useEffect, useCallback, useState } from 'react';
import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  ListBulletIcon,
  PlusIcon,
  PaperClipIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import CommandMenu from './CommandMenu';

// ---------------------------------------------------------------------------
// HeadingDropdown — "Tt" text-styles menu matching the mockup design
// ---------------------------------------------------------------------------

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const HEADING_OPTIONS: Array<{
  label: string;
  level: HeadingLevel | null;
  shortcut: string;
  labelClass: string;
}> = [
  {
    label: 'Normal text',
    level: null,
    shortcut: '⌘⌥0',
    labelClass: 'text-sm font-normal text-gray-800 dark:text-slate-200',
  },
  {
    label: 'Heading 1',
    level: 1,
    shortcut: '⌘⌥1',
    labelClass: 'text-[1.5rem] font-bold leading-tight text-gray-900 dark:text-white',
  },
  {
    label: 'Heading 2',
    level: 2,
    shortcut: '⌘⌥2',
    labelClass: 'text-[1.25rem] font-bold leading-tight text-gray-900 dark:text-white',
  },
  {
    label: 'Heading 3',
    level: 3,
    shortcut: '⌘⌥3',
    labelClass: 'text-[1.075rem] font-semibold leading-snug text-gray-900 dark:text-slate-100',
  },
  {
    label: 'Heading 4',
    level: 4,
    shortcut: '⌘⌥4',
    labelClass: 'text-[0.9375rem] font-semibold text-gray-800 dark:text-slate-200',
  },
  {
    label: 'Heading 5',
    level: 5,
    shortcut: '⌘⌥5',
    labelClass: 'text-sm font-semibold text-gray-700 dark:text-slate-300',
  },
  {
    label: 'Heading 6',
    level: 6,
    shortcut: '⌘⌥6',
    labelClass: 'text-sm font-semibold text-gray-400 dark:text-slate-500',
  },
];

interface HeadingDropdownProps {
  editor: Editor | null;
}

const HeadingDropdown = ({ editor }: HeadingDropdownProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // [why] editor.isActive() reads the current selection from the editor state.
  // Calling it inline during render only fires when React re-renders this component
  // due to prop/state changes — it misses cursor movements that don't touch props.
  // useEditorState subscribes to every editor transaction so the label updates
  // immediately on every selection/content change.
  const { activeLevel } = useEditorState({
    editor,
    selector: (ctx) => ({
      activeLevel:
        ctx.editor
          ? (([1, 2, 3, 4, 5, 6] as HeadingLevel[]).find((l) =>
              ctx.editor!.isActive('heading', { level: l }),
            ) ?? null)
          : null,
    }),
  }) ?? { activeLevel: null };

  const activeLabel =
    activeLevel === null
      ? 'Normal text'
      : `Heading ${activeLevel}`;

  const apply = (level: HeadingLevel | null) => {
    if (!editor) return;
    if (level === null) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level }).run();
    }
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        title="Text styles"
        aria-label="Text styles"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-0.5 rounded border border-gray-200 px-1.5 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="font-semibold tracking-tight">{activeLabel === 'Normal text' ? 'Tt' : activeLabel.replace('Heading ', 'H')}</span>
        <ChevronDownIcon className="h-3 w-3 shrink-0 opacity-60" />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="menu"
          aria-label="Text styles"
          className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Tooltip-style header */}
          <div className="border-b border-gray-100 px-3 py-1.5 dark:border-slate-800">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500">
              Text styles
            </span>
          </div>

          <div className="py-1">
            {HEADING_OPTIONS.map((opt) => {
              const isActive =
                opt.level === null
                  ? activeLevel === null
                  : activeLevel === opt.level;
              return (
                <button
                  key={opt.label}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-slate-700/60 ${
                    isActive ? 'bg-indigo-50 dark:bg-indigo-800/40' : ''
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    apply(opt.level);
                  }}
                >
                  <span className={opt.labelClass}>{opt.label}</span>
                  <kbd className="ml-3 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-400 dark:bg-slate-700 dark:text-slate-400">
                    {opt.shortcut}
                  </kbd>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

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
      {/* Text styles (heading) dropdown — always first */}
      <HeadingDropdown editor={editor} />

      {/* Divider */}
      <span className="mx-0.5 h-4 w-px shrink-0 bg-gray-200 dark:bg-slate-700" aria-hidden />

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
