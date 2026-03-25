// Modal showing keyboard shortcuts and markdown cheat sheet for the rich text editor.
// Opened via the ? button in OneLineToolbar.
import { XMarkIcon } from '@heroicons/react/24/outline';

interface Props {
  onClose: () => void;
}

const SHORTCUTS = [
  { label: 'Navigate to editor toolbar', keys: ['Opt', 'F9'] },
  { label: 'Navigate to floating toolbar', keys: ['Opt', 'F10'] },
  { label: 'Clear formatting', keys: ['⌘', '\\'] },
  { label: 'Undo', keys: ['⌘', 'Z'] },
  { label: 'Redo', keys: ['⌘', 'Y'] },
  { label: 'Paste plain text', keys: ['⌘', 'Shift', 'V'] },
  { label: 'Comment', keys: ['⌘', 'Opt', 'C'] },
  { label: 'Toggle action item', keys: ['⌘', 'Opt', '↵'] },
  { label: 'Toggle highlight color palette', keys: ['⌘', 'Opt', 'B'] },
  { label: 'Bold', keys: ['⌘', 'B'] },
  { label: 'Italic', keys: ['⌘', 'I'] },
  { label: 'Strikethrough', keys: ['⌘', 'Shift', 'S'] },
  { label: 'Heading 1', keys: ['⌘', 'Opt', '1'] },
  { label: 'Heading 2', keys: ['⌘', 'Opt', '2'] },
  { label: 'Heading 3', keys: ['⌘', 'Opt', '3'] },
  { label: 'Heading 4', keys: ['⌘', 'Opt', '4'] },
  { label: 'Heading 5', keys: ['⌘', 'Opt', '5'] },
  { label: 'Heading 6', keys: ['⌘', 'Opt', '6'] },
  { label: 'Normal text', keys: ['⌘', 'Opt', '0'] },
  { label: 'Numbered list', keys: ['⌘', 'Shift', '7'] },
];

const MARKDOWN = [
  { label: 'Bold', syntax: '**Bold**' },
  { label: 'Italic', syntax: '*Italic*' },
  { label: 'Strikethrough', syntax: '~~Strikethrough~~' },
  { label: 'Heading 1', syntax: '# Space' },
  { label: 'Heading 2', syntax: '## Space' },
  { label: 'Heading 3', syntax: '### Space' },
  { label: 'Heading 4', syntax: '#### Space' },
  { label: 'Heading 5', syntax: '##### Space' },
  { label: 'Heading 6', syntax: '###### Space' },
  { label: 'Numbered list', syntax: '1. Space' },
  { label: 'Bullet list', syntax: '* Space' },
  { label: 'Quote', syntax: '> Space' },
  { label: 'Code snippet', syntax: '```' },
  { label: 'Divider', syntax: '---' },
  { label: 'Link', syntax: '[Link](http://a.com)' },
  { label: 'Code', syntax: '`Code`' },
  { label: 'Image', syntax: '![Alt text](http://www.image.com)' },
];

const Kbd = ({ children }: { children: string }) => (
  <kbd className="inline-flex items-center rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-200">
    {children}
  </kbd>
);

const EditorHelpModal = ({ onClose }: Props) => (
  <div
    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
    onMouseDown={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
  >
    <div className="relative w-full max-w-2xl overflow-hidden rounded-xl bg-slate-800 shadow-2xl ring-1 ring-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
        <h2 className="text-base font-semibold text-white">Editor help</h2>
        <button
          type="button"
          aria-label="Close editor help"
          className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          onClick={onClose}
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-2 gap-8">
          {/* Keyboard shortcuts */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Keyboard shortcuts
            </h3>
            <ul className="space-y-1.5">
              {SHORTCUTS.map(({ label, keys }) => (
                <li key={label} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-200">{label}</span>
                  <span className="flex shrink-0 items-center gap-0.5">
                    {keys.map((k, i) => (
                      <span key={k} className="flex items-center gap-0.5">
                        {i > 0 && <span className="text-[10px] text-slate-500">+</span>}
                        <Kbd>{k}</Kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Markdown */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Markdown
            </h3>
            <ul className="space-y-1.5">
              {MARKDOWN.map(({ label, syntax }) => (
                <li key={label} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-200">{label}</span>
                  <code className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[11px] text-indigo-300">
                    {syntax}
                  </code>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-700 px-6 py-3">
        <p className="text-center text-xs text-slate-400">
          Press <Kbd>⌘</Kbd> <span className="mx-1 text-slate-500">+</span> <Kbd>/</Kbd> to quickly open this dialog at any time
        </p>
      </div>
    </div>
  </div>
);

export default EditorHelpModal;
