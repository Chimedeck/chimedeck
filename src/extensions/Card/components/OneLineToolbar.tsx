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
  QuestionMarkCircleIcon,
  LinkIcon,
  NumberedListIcon,
} from '@heroicons/react/24/outline';
import EditorHelpModal from './EditorHelpModal';
import CommandMenu from './CommandMenu';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

type OverflowCommand = {
  id: string;
  label: string;
  keywords: string[];
  icon: React.ReactNode;
  execute: (editor: Editor) => void;
};

function buildHiddenResponsiveCommands({
  visibleResponsiveButtonCount,
  onAttach,
  linkPopoverOpen,
  onToggleLinkPopover,
  setEmojiPickerOpen,
  setHelpOpen,
}: {
  visibleResponsiveButtonCount: number;
  onAttach?: () => void;
  linkPopoverOpen: boolean;
  onToggleLinkPopover?: () => void;
  setEmojiPickerOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
}): OverflowCommand[] {
  const hiddenResponsiveCommands: OverflowCommand[] = [];

  if (visibleResponsiveButtonCount <= 0) {
    hiddenResponsiveCommands.push({
      id: 'bold',
      label: 'Bold',
      keywords: ['bold', 'strong', 'b'],
      icon: <BoldIcon className="h-3.5 w-3.5 shrink-0" />,
      execute: (ed) => { ed.chain().focus().toggleBold().run(); },
    });
  }
  if (visibleResponsiveButtonCount <= 1) {
    hiddenResponsiveCommands.push({
      id: 'italic',
      label: 'Italic',
      keywords: ['italic', 'emphasis', 'i'],
      icon: <ItalicIcon className="h-3.5 w-3.5 shrink-0" />,
      execute: (ed) => { ed.chain().focus().toggleItalic().run(); },
    });
  }
  if (visibleResponsiveButtonCount <= 2) {
    hiddenResponsiveCommands.push({
      id: 'strikethrough',
      label: 'Strikethrough',
      keywords: ['strike', 'strikethrough', 'delete'],
      icon: <StrikethroughIcon className="h-3.5 w-3.5 shrink-0" />,
      execute: (ed) => { ed.chain().focus().toggleStrike().run(); },
    });
  }
  if (visibleResponsiveButtonCount <= 3) {
    hiddenResponsiveCommands.push({
      id: 'list',
      label: 'Toggle bullet list',
      keywords: ['list', 'bullet', 'ul'],
      icon: <ListBulletIcon className="h-3.5 w-3.5 shrink-0" />,
      execute: (ed) => { ed.chain().focus().toggleBulletList().run(); },
    });
  }
  if (visibleResponsiveButtonCount <= 4) {
    hiddenResponsiveCommands.push({
      id: 'link',
      label: 'Insert link',
      keywords: ['link', 'url', 'href'],
      icon: <LinkIcon className="h-3.5 w-3.5 shrink-0" />,
      execute: () => {
        if (!linkPopoverOpen) {
          setEmojiPickerOpen(false);
          setHelpOpen(false);
        }
        onToggleLinkPopover?.();
      },
    });
  }

  if (onAttach && visibleResponsiveButtonCount <= 5) {
    hiddenResponsiveCommands.push({
      id: 'attach-file',
      label: 'Attach file',
      keywords: ['attach', 'file', 'upload'],
      icon: <PaperClipIcon className="h-3.5 w-3.5 shrink-0" />,
      execute: () => { onAttach(); },
    });
  }

  const helpVisibleThreshold = onAttach ? 6 : 5;
  if (visibleResponsiveButtonCount <= helpVisibleThreshold) {
    hiddenResponsiveCommands.push({
      id: 'editor-help',
      label: 'Editor help',
      keywords: ['help', 'shortcut', 'editor'],
      icon: <QuestionMarkCircleIcon className="h-3.5 w-3.5 shrink-0" />,
      execute: () => { setHelpOpen(true); },
    });
  }

  return hiddenResponsiveCommands;
}

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
    labelClass: 'text-sm font-normal text-base',
  },
  {
    label: 'Heading 1',
    level: 1,
    shortcut: '⌘⌥1',
    labelClass: 'text-[1.5rem] font-bold leading-tight text-base',
  },
  {
    label: 'Heading 2',
    level: 2,
    shortcut: '⌘⌥2',
    labelClass: 'text-[1.25rem] font-bold leading-tight text-base',
  },
  {
    label: 'Heading 3',
    level: 3,
    shortcut: '⌘⌥3',
    labelClass: 'text-[1.075rem] font-semibold leading-snug text-base',
  },
  {
    label: 'Heading 4',
    level: 4,
    shortcut: '⌘⌥4',
    labelClass: 'text-[0.9375rem] font-semibold text-base',
  },
  {
    label: 'Heading 5',
    level: 5,
    shortcut: '⌘⌥5',
    labelClass: 'text-sm font-semibold text-base',
  },
  {
    label: 'Heading 6',
    level: 6,
    shortcut: '⌘⌥6',
    labelClass: 'text-sm font-semibold text-subtle',
  },
];

// ---------------------------------------------------------------------------
// ListDropdown — bullet/numbered list picker matching the mockup design
// ---------------------------------------------------------------------------

interface ListDropdownProps {
  editor: Editor | null;
}

const ListDropdown = ({ editor }: ListDropdownProps) => {
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

  const { isBullet, isOrdered } = useEditorState({
    editor,
    selector: (ctx) => ({
      isBullet: ctx.editor?.isActive('bulletList') ?? false,
      isOrdered: ctx.editor?.isActive('orderedList') ?? false,
    }),
  }) ?? { isBullet: false, isOrdered: false };

  const isAnyActive = isBullet || isOrdered;

  const btn =
    'p-1.5 text-xs rounded border border-border text-base hover:bg-bg-overlay transition-colors';
  const btnActive = 'bg-primary/10 text-primary';

  return (
    <div ref={ref} className="relative">
      {/* Trigger — shows current active list icon or default bullet icon */}
      <button
        type="button"
        title="List"
        aria-label="List"
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-0.5 ${btn} ${isAnyActive ? btnActive : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {isOrdered ? (
          <NumberedListIcon className="h-3.5 w-3.5" />
        ) : (
          <ListBulletIcon className="h-3.5 w-3.5" />
        )}
        <ChevronDownIcon className="h-3 w-3 shrink-0 opacity-60" />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="menu"
          aria-label="List type"
          className="absolute left-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-bg-surface shadow-xl"
        >
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={isBullet}
            className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-bg-overlay ${isBullet ? 'bg-primary/10' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              editor?.chain().focus().toggleBulletList().run();
              setOpen(false);
            }}
          >
            <span className="flex items-center gap-2">
              <ListBulletIcon className="h-3.5 w-3.5 shrink-0" />
              Bullet list
            </span>
            <kbd className="ml-3 shrink-0 rounded bg-bg-overlay px-1.5 py-0.5 font-mono text-[10px] text-subtle">⌘⇧8</kbd>
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={isOrdered}
            className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-bg-overlay ${isOrdered ? 'bg-primary/10' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              editor?.chain().focus().toggleOrderedList().run();
              setOpen(false);
            }}
          >
            <span className="flex items-center gap-2">
              <NumberedListIcon className="h-3.5 w-3.5 shrink-0" />
              Numbered list
            </span>
            <kbd className="ml-3 shrink-0 rounded bg-bg-overlay px-1.5 py-0.5 font-mono text-[10px] text-subtle">⌘⇧7</kbd>
          </button>
        </div>
      )}
    </div>
  );
};

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
        className="flex items-center gap-0.5 rounded border border-border px-1.5 py-1 text-xs text-base transition-colors hover:bg-bg-overlay"
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
          className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-bg-surface shadow-xl"
        >
          {/* Tooltip-style header */}
          <div className="border-b border-gray-100 px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-subtle">
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
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-bg-overlay ${
                    isActive ? 'bg-primary/10' : ''
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    apply(opt.level);
                  }}
                >
                  <span className={opt.labelClass}>{opt.label}</span>
                  <kbd className="ml-3 shrink-0 rounded bg-bg-overlay px-1.5 py-0.5 font-mono text-[10px] text-subtle">
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
  /** Controlled open state for the link insert popover */
  linkPopoverOpen?: boolean;
  /** Called when the link button is clicked — parent controls the open state */
  onToggleLinkPopover?: () => void;
}

const OneLineToolbar = ({ editor, overflowOpen, onToggleOverflow, onAttach, linkPopoverOpen = false, onToggleLinkPopover }: Props) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const fixedStartRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const responsiveButtonRefs = useRef<Array<HTMLDivElement | null>>([]);
  const responsiveButtonWidthCacheRef = useRef<number[]>([]);
  const overflowRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [visibleResponsiveButtonCount, setVisibleResponsiveButtonCount] = useState(7 + (onAttach ? 1 : 0));

  // Open help modal with ⌘+/ keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setHelpOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close emoji picker when clicking outside.
  // [why] The listener is registered in a setTimeout(0) so the same mousedown
  // event that triggered the picker to open doesn't immediately close it.
  useEffect(() => {
    if (!emojiPickerOpen) return;
    let handler: ((e: MouseEvent) => void) | null = null;
    const timer = setTimeout(() => {
      handler = (e: MouseEvent) => {
        if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
          setEmojiPickerOpen(false);
        }
      };
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      if (handler) document.removeEventListener('mousedown', handler);
    };
  }, [emojiPickerOpen]);

  const handleEmojiSelect = useCallback(
    (emoji: { native?: string }) => {
      if (!editor || !emoji.native) return;
      editor.chain().focus().insertContent(emoji.native).run();
      setEmojiPickerOpen(false);
    },
    [editor],
  );

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
    'p-1.5 text-xs rounded border border-border text-base hover:bg-bg-overlay transition-colors';
  const btnActive = 'bg-primary/10 text-primary';

  const responsiveButtonTotal = 7 + (onAttach ? 1 : 0);
  const helpButtonIndex = onAttach ? 6 : 5;

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const recalculateVisibleButtons = () => {
      const fixedStartWidth = fixedStartRef.current?.offsetWidth ?? 0;
      const plusButtonWidth = plusButtonRef.current?.offsetWidth ?? 0;
      const availableForResponsiveButtons = Math.max(
        0,
        toolbar.clientWidth - fixedStartWidth - plusButtonWidth - 20,
      );

      let used = 0;
      let nextVisibleCount = 0;

      for (let i = 0; i < responsiveButtonTotal; i += 1) {
        const measuredWidth = responsiveButtonRefs.current[i]?.offsetWidth ?? 0;
        if (measuredWidth > 0) {
          responsiveButtonWidthCacheRef.current[i] = measuredWidth;
        }
        const width = responsiveButtonWidthCacheRef.current[i] ?? measuredWidth;
        if (width <= 0) continue;
        if (used + width > availableForResponsiveButtons) break;
        used += width;
        nextVisibleCount += 1;
      }

      setVisibleResponsiveButtonCount(Math.max(0, Math.min(nextVisibleCount, responsiveButtonTotal)));
    };

    const raf = requestAnimationFrame(recalculateVisibleButtons);
    const observer = new ResizeObserver(recalculateVisibleButtons);
    observer.observe(toolbar);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [responsiveButtonTotal]);

  useEffect(() => {
    setVisibleResponsiveButtonCount(responsiveButtonTotal);
    responsiveButtonWidthCacheRef.current = [];
  }, [onAttach, responsiveButtonTotal]);

  const hiddenResponsiveCommands = buildHiddenResponsiveCommands({
    visibleResponsiveButtonCount,
    onAttach,
    linkPopoverOpen,
    onToggleLinkPopover,
    setEmojiPickerOpen,
    setHelpOpen,
  });

  return (
    <>
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Text formatting"
      className="z-20 flex w-full min-w-0 items-center gap-1 overflow-visible border-b border-border bg-bg-surface p-2 shadow-md"
    >
      <div ref={fixedStartRef} className="flex shrink-0 items-center gap-1">
        {/* Text styles (heading) dropdown — always first */}
        <HeadingDropdown editor={editor} />

        {/* Divider */}
        <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
      </div>

      {/* Primary controls — always visible */}
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        <div ref={(el) => { responsiveButtonRefs.current[0] = el; }} className={visibleResponsiveButtonCount > 0 ? 'shrink-0' : 'hidden'}>
          <button
            type="button"
            aria-label="Bold"
            title="Bold"
            className={`${btn} ${editor?.isActive('bold') ? btnActive : ''}`}
            onMouseDown={runCmd(() => editor?.chain().focus().toggleBold().run() ?? false)}
          >
            <BoldIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div ref={(el) => { responsiveButtonRefs.current[1] = el; }} className={visibleResponsiveButtonCount > 1 ? 'shrink-0' : 'hidden'}>
          <button
            type="button"
            aria-label="Italic"
            title="Italic"
            className={`${btn} ${editor?.isActive('italic') ? btnActive : ''}`}
            onMouseDown={runCmd(() => editor?.chain().focus().toggleItalic().run() ?? false)}
          >
            <ItalicIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div ref={(el) => { responsiveButtonRefs.current[2] = el; }} className={visibleResponsiveButtonCount > 2 ? 'shrink-0' : 'hidden'}>
          <button
            type="button"
            aria-label="Strikethrough"
            title="Strikethrough"
            className={`${btn} ${editor?.isActive('strike') ? btnActive : ''}`}
            onMouseDown={runCmd(() => editor?.chain().focus().toggleStrike().run() ?? false)}
          >
            <StrikethroughIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div ref={(el) => { responsiveButtonRefs.current[3] = el; }} className={visibleResponsiveButtonCount > 3 ? 'shrink-0' : 'hidden'}>
          {/* List dropdown — bullet + numbered */}
          <ListDropdown editor={editor} />
        </div>

        <div ref={(el) => { responsiveButtonRefs.current[4] = el; }} className={visibleResponsiveButtonCount > 4 ? 'shrink-0' : 'hidden'}>
          {/* Hyperlink button */}
          <button
            type="button"
            aria-label="Insert link"
            title="Insert link"
            className={`${btn} ${linkPopoverOpen || editor?.isActive('link') ? btnActive : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!linkPopoverOpen) {
                // Close internal panels before parent opens the link popover
                if (overflowOpen) onToggleOverflow();
                setEmojiPickerOpen(false);
                setHelpOpen(false);
              }
              onToggleLinkPopover?.();
            }}
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Attach file button — shown when caller provides onAttach handler */}
        {onAttach && (
          <div ref={(el) => { responsiveButtonRefs.current[5] = el; }} className={visibleResponsiveButtonCount > 5 ? 'shrink-0' : 'hidden'}>
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
          </div>
        )}

        <div
          ref={(el) => {
            responsiveButtonRefs.current[helpButtonIndex] = el;
          }}
          className={visibleResponsiveButtonCount > helpButtonIndex ? 'shrink-0' : 'hidden'}
        >
          {/* Help button */}
          <button
            type="button"
            aria-label="Editor help"
            title="Editor help (⌘+/)"
            className={btn}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setHelpOpen(true);
            }}
          >
            <QuestionMarkCircleIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Overflow + button — secondary controls */}
      <div ref={overflowRef} className="relative ml-auto">
        <button
          ref={plusButtonRef}
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
            <CommandMenu
              editor={editor}
              onClose={onToggleOverflow}
              onOpenEmojiPicker={() => setEmojiPickerOpen(true)}
              extraCommands={hiddenResponsiveCommands}
            />
          )}

        {/* Emoji picker — shown instead of command menu after selecting Emoji */}
        {emojiPickerOpen && (
          <div
            ref={emojiRef}
            className="absolute right-0 top-full z-50 mt-1"
          >
            <Picker
              data={data}
              onEmojiSelect={handleEmojiSelect}
              theme="dark"
              previewPosition="bottom"
              skinTonePosition="none"
            />
          </div>
        )}
      </div>
    </div>

      {/* Editor help modal — rendered via portal outside the toolbar div */}
      {helpOpen && <EditorHelpModal onClose={() => setHelpOpen(false)} />}
    </>
  );
};

export default OneLineToolbar;
