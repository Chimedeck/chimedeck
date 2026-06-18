// SpecsMarkdownEditor — TipTap-based markdown editor for specs files.
// Markdown-first: content is serialized/deserialized as plain markdown text.
// Toolbar is tuned for specs authoring (headings, bold/italic, lists, code, links, blockquote, hr).
import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Link from '@tiptap/extension-link';

export interface SpecsMarkdownEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
}

// Toolbar button — shared style for active / inactive states.
function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
}: {
  readonly onClick: () => void;
  readonly isActive?: boolean;
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // Prevent editor losing focus when clicking toolbar
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={[
        'inline-flex items-center justify-center rounded px-2 py-1 text-xs font-medium transition-colors',
        isActive
          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200'
          : 'text-muted hover:bg-bg-overlay hover:text-base',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

const SpecsMarkdownEditor = ({ content, onChange, readOnly = false }: SpecsMarkdownEditorProps) => {
  const isHydratedRef = useRef(false);

  const editor = useEditor({
    extensions: [StarterKit, Markdown, Link.configure({ openOnClick: false })],
    content: '',
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => {
      if (!isHydratedRef.current) {
        return;
      }

      // [why] Use the Markdown extension's storage to get the canonical markdown string
      const md =
        (ed.storage as { markdown?: { getMarkdown?: () => string } }).markdown?.getMarkdown?.() ??
        ed.getHTML();
      onChange(md);
    },
  });

  // Sync external content changes (e.g. file switch) into the editor
  useEffect(() => {
    if (!editor) return;
    const currentMd =
      (editor.storage as { markdown?: { getMarkdown?: () => string } }).markdown?.getMarkdown?.() ??
      '';
    // Only reset if content genuinely changed to avoid clobbering cursor position
    if (currentMd !== content) {
      isHydratedRef.current = false;
      editor.commands.setContent(content, { contentType: 'markdown' });
      queueMicrotask(() => {
        isHydratedRef.current = true;
      });
    }
  }, [editor, content]);

  // Allow user edits after the initial editor mount has settled.
  useEffect(() => {
    if (!editor) return;
    const timer = globalThis.setTimeout(() => {
      isHydratedRef.current = true;
    }, 0);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [editor]);

  // Sync readOnly prop changes
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-bg-surface px-2 py-1 shrink-0">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            H3
          </ToolbarButton>

          <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Bold (⌘B)"
          >
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italic (⌘I)"
          >
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive('code')}
            title="Inline code"
          >
            {'<>'}
          </ToolbarButton>

          <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Bullet list"
          >
            •—
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Ordered list"
          >
            1.
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive('codeBlock')}
            title="Code block"
          >
            {'```'}
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="Blockquote"
          >
            "
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            isActive={false}
            title="Horizontal rule"
          >
            —
          </ToolbarButton>
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <EditorContent
          editor={editor}
          className={[
            'prose prose-sm dark:prose-invert max-w-none h-full focus:outline-none',
            '[&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:outline-none',
          ].join(' ')}
        />
      </div>
    </div>
  );
};

export default SpecsMarkdownEditor;
