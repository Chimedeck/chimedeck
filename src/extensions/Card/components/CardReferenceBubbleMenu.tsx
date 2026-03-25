// Floating action menu shown when a cardReference node is selected in the editor.
// Matches the mockup wireframe: chain/link icon, open-in-tab, copy-link, delete.
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import {
  ArrowTopRightOnSquareIcon,
  LinkIcon,
  DocumentDuplicateIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface Props {
  editor: Editor;
}

const CardReferenceBubbleMenu = ({ editor }: Props) => {
  const handleOpen = () => {
    const href = editor.getAttributes('cardReference')['href'] as string | undefined;
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = () => {
    const href = editor.getAttributes('cardReference')['href'] as string | undefined;
    if (href) void navigator.clipboard.writeText(href);
  };

  const handleDelete = () => {
    editor.chain().focus().deleteSelection().run();
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top-start' }}
      shouldShow={({ editor: ed }) => ed.isActive('cardReference')}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white px-2 py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        {/* Label */}
        <span className="mr-1 text-xs text-gray-500 dark:text-slate-400">Edit link</span>

        {/* Open in new tab */}
        <button
          type="button"
          title="Open card"
          className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          onMouseDown={(e) => { e.preventDefault(); handleOpen(); }}
        >
          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
        </button>

        {/* Copy link */}
        <button
          type="button"
          title="Copy link"
          className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          onMouseDown={(e) => { e.preventDefault(); handleCopy(); }}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>

        {/* Duplicate link as text */}
        <button
          type="button"
          title="Copy URL to clipboard"
          className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          onMouseDown={(e) => { e.preventDefault(); handleCopy(); }}
        >
          <DocumentDuplicateIcon className="h-3.5 w-3.5" />
        </button>

        {/* Remove chip */}
        <button
          type="button"
          title="Remove reference"
          className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-400"
          onMouseDown={(e) => { e.preventDefault(); handleDelete(); }}
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </BubbleMenu>
  );
};

export default CardReferenceBubbleMenu;
