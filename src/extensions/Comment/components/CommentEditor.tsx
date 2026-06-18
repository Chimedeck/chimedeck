// Rich text editor for composing or editing a comment.
// Uses Tiptap with the shared OneLineToolbar (single-line, no wrapping).
// Integrates offline draft persistence: debounce-saves on every keystroke,
// background-syncs to server when online, restores draft on card open, and
// queues the POST with an idempotency key when submitting while offline.
import { useState, useEffect, useCallback, useRef } from 'react';
import type React from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Link from '@tiptap/extension-link';
import type { Editor } from '@tiptap/react';
import { getMarkRange } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import {
  AdjustmentsHorizontalIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  LinkIcon,
  MinusIcon,
  RectangleStackIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { Attachment } from '~/extensions/Attachments/types';
import InlineImage from '../extensions/InlineImage';
import { buildMentionExtension } from '~/extensions/Mention/TiptapMentionExtension';
import CardReference from '~/extensions/Card/extensions/CardReferenceExtension';
import CardReferenceBubbleMenu from '~/extensions/Card/components/CardReferenceBubbleMenu';
import {
  dehydrateCommentAttachmentMarkdown,
  hasAttachmentPlaceholder,
  hydrateCommentAttachmentMarkdown,
  resolveAttachmentMarkdownUrl,
  stripCommentAttachmentPlaceholders,
} from '~/extensions/Comment/utils/attachmentMarkdown';
import { rewriteS3UrlsToProxy } from '~/common/utils/rewriteS3UrlsToProxy';
import { CardAssetPicker } from './CardAssetPicker';
import { useSelector } from 'react-redux';
import OneLineToolbar from '~/extensions/Card/components/OneLineToolbar';
import LinkInsertPopover from '~/extensions/Card/components/LinkInsertPopover';
import { useAttachmentUpload } from '~/extensions/Attachments/hooks/useAttachmentUpload';
import { fetchLinkPreview, listAttachments } from '~/extensions/Attachments/api';
import { InlineUploadPreview } from '~/extensions/Attachments/components/InlineUploadPreview';
import {
  useOfflineCommentDraft,
  type DraftStatus,
} from '~/extensions/OfflineDrafts/hooks/useOfflineCommentDraft';
import { selectCurrentUser, selectAccessToken } from '~/slices/authSlice';
import { selectActiveWorkspaceId } from '~/extensions/Workspace/duck/workspaceDuck';
import Button from '~/common/components/Button';
import { getInlineTitleFromUrl, normalizeHttpUrlInput } from '~/common/utils/urlDisplayText';
import { escapeScriptTags } from '~/common/utils/escapeScriptTags';
import translations from '../translations/en.json';

const LINK_CLASS_BUTTON = 'cd-link-button';
const LINK_CLASS_CARD = 'cd-link-card';
const LINK_CLASS_URL = 'cd-link-url';
const LINK_CLASS_LOADING = 'cd-link-loading';
const LINK_MODE_TITLE_PREFIX = 'cd-mode:';
const LINK_MODE_META_URL = 'cd-link-mode-url';
const LINK_MODE_META_BUTTON = 'cd-link-mode-button';
const LINK_MODE_META_CARD = 'cd-link-mode-card';

type LinkDisplayMode = 'url' | 'button' | 'card';

function getModeMetaToken(mode: LinkDisplayMode): string {
  if (mode === 'url') return LINK_MODE_META_URL;
  if (mode === 'card') return LINK_MODE_META_CARD;
  return LINK_MODE_META_BUTTON;
}

function getVisualClassForMode(mode: LinkDisplayMode): string {
  if (mode === 'url') return LINK_CLASS_URL;
  if (mode === 'card') return LINK_CLASS_CARD;
  return LINK_CLASS_BUTTON;
}

function buildLinkClassName(mode: LinkDisplayMode, extraTokens: string[] = []): string {
  const tokens = [getVisualClassForMode(mode), getModeMetaToken(mode), ...extraTokens]
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  return Array.from(new Set(tokens)).join(' ');
}

function buildLinkModeTitle(mode: LinkDisplayMode): string {
  return `${LINK_MODE_TITLE_PREFIX}${mode}`;
}

function getModeFromTitle(value: unknown): LinkDisplayMode | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === `${LINK_MODE_TITLE_PREFIX}url`) return 'url';
  if (trimmed === `${LINK_MODE_TITLE_PREFIX}button`) return 'button';
  if (trimmed === `${LINK_MODE_TITLE_PREFIX}card`) return 'card';
  return null;
}

function getModeFromClassName(className: string | null | undefined): LinkDisplayMode | null {
  if (!className) return null;
  const tokens = new Set(className.split(/\s+/).filter(Boolean));
  if (tokens.has(LINK_MODE_META_URL)) return 'url';
  if (tokens.has(LINK_MODE_META_CARD)) return 'card';
  if (tokens.has(LINK_MODE_META_BUTTON)) return 'button';
  return null;
}

interface ActiveEditorLink {
  anchorEl: HTMLAnchorElement | null;
  from: number;
  to: number;
  href: string;
  text: string;
  mode: LinkDisplayMode;
  rect: DOMRect;
}

function normalizeComparableUrl(value: string): string {
  const normalized = normalizeHttpUrlInput(value) ?? value.trim();
  try {
    const parsed = new URL(normalized);
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return normalized.replace(/\/$/, '');
  }
}

function detectLinkDisplayMode(
  className: string | null | undefined,
  text: string,
  href: string,
  title?: string | null,
  hasVisualLineBreak = false,
): LinkDisplayMode {
  const modeFromMetadata = getModeFromClassName(className);
  if (modeFromMetadata) return modeFromMetadata;

  const modeFromTitle = getModeFromTitle(title);
  if (modeFromTitle) return modeFromTitle;

  if (className?.includes(LINK_CLASS_URL)) return 'url';
  if (className?.includes(LINK_CLASS_CARD) || hasVisualLineBreak || text.includes('\n')) return 'card';
  if (className?.includes(LINK_CLASS_BUTTON)) return 'button';

  const normalizedHref = normalizeComparableUrl(href);
  const normalizedText = normalizeComparableUrl(text);
  if (normalizedHref.length > 0 && normalizedHref === normalizedText) return 'url';

  return 'button';
}

function getLinkLabelText(text: string): string {
  const firstLine = text.split('\n')[0]?.trim() ?? '';
  return firstLine || text.trim();
}

function buildCardLinkText(label: string, href: string): string {
  const normalized = normalizeHttpUrlInput(href) ?? href;
  try {
    const host = new URL(normalized).hostname.replace(/^www\./i, '');
    return `${label}\n${host}`;
  } catch {
    return label;
  }
}

interface LinkRangeTarget {
  from: number;
  to: number;
  attrs: Record<string, unknown>;
}

function findLinkRangeByClassToken(editor: Editor, classToken: string): LinkRangeTarget | null {
  const linkType = editor.state.schema.marks.link;
  if (!linkType) return null;

  let found: LinkRangeTarget | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (!node.isText || !node.text || node.text.length === 0) return;

    const linkMark = node.marks.find((mark) => {
      if (mark.type !== linkType) return false;
      const classValue = typeof mark.attrs.class === 'string' ? mark.attrs.class : '';
      return classValue.split(/\s+/).filter(Boolean).includes(classToken);
    });
    if (!linkMark) return;

    const resolvePos = Math.max(1, Math.min(pos + 1, editor.state.doc.content.size));
    const range = getMarkRange(editor.state.doc.resolve(resolvePos), linkType);
    if (!range) return;

    found = {
      from: range.from,
      to: range.to,
      attrs: linkMark.attrs as Record<string, unknown>,
    };

    return false;
  });

  return found;
}

function replaceLinkRangeText(
  editor: Editor,
  target: LinkRangeTarget,
  text: string,
  className: string,
): void {
  const linkType = editor.state.schema.marks.link;
  if (!linkType) return;

  const href = typeof target.attrs.href === 'string' ? target.attrs.href.trim() : '';
  if (!href) return;

  const mark = linkType.create({
    ...target.attrs,
    href,
    target: '_blank',
    rel: 'noopener noreferrer',
    class: className,
  });
  const textNode = editor.state.schema.text(text, [mark]);
  const tr = editor.state.tr.replaceWith(target.from, target.to, textNode);
  editor.view.dispatch(tr);
}

function hydrateEditorLinkMarkClasses(editor: Editor): void {
  const linkType = editor.state.schema.marks.link;
  if (!linkType) return;

  const tr = editor.state.tr;
  const seenRanges = new Set<string>();

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text || node.text.length === 0) return;

    const hasLinkMark = node.marks.some((mark) => mark.type === linkType);
    if (!hasLinkMark) return;

    const resolvePos = Math.max(1, Math.min(pos + 1, editor.state.doc.content.size));
    const range = getMarkRange(editor.state.doc.resolve(resolvePos), linkType);
    if (!range) return;

    const rangeKey = `${String(range.from)}:${String(range.to)}`;
    if (seenRanges.has(rangeKey)) return;
    seenRanges.add(rangeKey);

    const linkAttrs = editor.state.doc
      .resolve(range.from)
      .marks()
      .find((mark) => mark.type === linkType)?.attrs as Record<string, unknown> | undefined;

    const href = typeof linkAttrs?.href === 'string' ? linkAttrs.href.trim() : '';
    if (!href) return;

    const currentClass = typeof linkAttrs?.class === 'string' ? linkAttrs.class : '';
    const text = editor.state.doc.textBetween(range.from, range.to, '\n');

    let hasHardBreak = false;
    editor.state.doc.nodesBetween(range.from, range.to, (child) => {
      if (child.type.name === 'hardBreak') {
        hasHardBreak = true;
        return false;
      }
      return undefined;
    });

    const title = typeof linkAttrs?.title === 'string' ? linkAttrs.title : null;
    const inferredMode = detectLinkDisplayMode(currentClass, text, href, title, hasHardBreak || text.includes('\n'));
    const nextClass = buildLinkClassName(inferredMode);

    if (currentClass === nextClass) return;

    tr.removeMark(range.from, range.to, linkType);
    tr.addMark(range.from, range.to, linkType.create({
      ...linkAttrs,
      class: nextClass,
      title: buildLinkModeTitle(inferredMode),
      target: '_blank',
      rel: 'noopener noreferrer',
    }));
  });

  if (tr.steps.length > 0) {
    editor.view.dispatch(tr);
  }
}

function findActiveLinkFromAnchor(editor: Editor, anchorEl: HTMLAnchorElement): ActiveEditorLink | null {
  const href = anchorEl.getAttribute('href')?.trim() ?? '';
  if (!href) return null;

  const linkType = editor.state.schema.marks.link;
  if (!linkType) return null;

  let range = null;
  const candidateOffsets = [0, 1, -1];
  for (const offset of candidateOffsets) {
    try {
      const basePos = editor.view.posAtDOM(anchorEl, 0);
      const safePos = Math.max(1, Math.min(basePos + offset, editor.state.doc.content.size));
      range = getMarkRange(editor.state.doc.resolve(safePos), linkType);
      if (range) break;
    } catch {
      // Try next candidate offset.
    }
  }

  if (!range) return null;

  const text = editor.state.doc.textBetween(range.from, range.to, '\n');
  const mode = detectLinkDisplayMode(
    anchorEl.getAttribute('class'),
    text,
    href,
    anchorEl.getAttribute('title'),
    Boolean(anchorEl.querySelector('br')),
  );

  return {
    anchorEl,
    from: range.from,
    to: range.to,
    href,
    text,
    mode,
    rect: anchorEl.getBoundingClientRect(),
  };
}

function findActiveLinkFromSelection(editor: Editor): ActiveEditorLink | null {
  if (!editor.isActive('link')) return null;

  const linkType = editor.state.schema.marks.link;
  if (!linkType) return null;

  const range = getMarkRange(editor.state.selection.$from, linkType);
  if (!range) return null;

  const attrs = editor.getAttributes('link') as Record<string, unknown>;
  const href = typeof attrs.href === 'string' ? attrs.href.trim() : '';
  if (!href) return null;

  const className = typeof attrs.class === 'string' ? attrs.class : null;
  const title = typeof attrs.title === 'string' ? attrs.title : null;
  const text = editor.state.doc.textBetween(range.from, range.to, '\n');

  const fromCoords = editor.view.coordsAtPos(range.from);
  const toCoords = editor.view.coordsAtPos(Math.max(range.from + 1, range.to));
  const left = Math.min(fromCoords.left, toCoords.left);
  const top = Math.min(fromCoords.top, toCoords.top);
  const right = Math.max(fromCoords.right, toCoords.right);
  const bottom = Math.max(fromCoords.bottom, toCoords.bottom);
  const rect = new DOMRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));

  let anchorEl: HTMLAnchorElement | null = null;
  try {
    const domAt = editor.view.domAtPos(range.from);
    const node = domAt.node instanceof Element ? domAt.node : domAt.node.parentElement;
    anchorEl = node?.closest('a') as HTMLAnchorElement | null;
  } catch {
    anchorEl = null;
  }

  const mode = detectLinkDisplayMode(className, text, href, title, Boolean(anchorEl?.querySelector('br')));

  return {
    anchorEl,
    from: range.from,
    to: range.to,
    href,
    text,
    mode,
    rect,
  };
}

interface Props {
  boardId?: string;
  cardId?: string;
  availableAttachments?: Attachment[];
  /** Notifies parent when editor-visible attachment list changes (e.g. paste upload success). */
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  initialValue?: string;
  placeholder?: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  /**
   * When provided, the editor will set this ref to an `insertMarkdown(md)` function
   * once ready. External callers (e.g. AttachmentPanel's Comment action) can use it
   * to insert markdown at the current cursor position without a network call.
   */
  insertMarkdownRef?: React.MutableRefObject<((md: string) => void) | null>;
}

// Map draft status to a human-readable footer label — mirrors description editor.
function draftStatusLabel(status: DraftStatus): string | null {
  switch (status) {
    case 'saving_local': return translations['comment.draft.saving'];
    case 'saved_local':  return translations['comment.draft.savedLocal'];
    case 'syncing':      return translations['comment.draft.syncing'];
    case 'synced':       return translations['comment.draft.synced'];
    case 'will_sync_when_online': return translations['comment.draft.willSync'];
    case 'sync_failed':  return translations['comment.draft.syncFailed'];
    default:             return null;
  }
}

// @tiptap/markdown may omit custom image nodes in some serialization paths.
// Ensure images in the current doc are present in the final markdown payload.
function buildCommentMarkdown(editor: Editor, attachments: Attachment[]): string {
  let markdown = editor.getMarkdown() || '';
  const imageSnippets: string[] = [];
  const scriptLiterals = Array.from(
    new Set((editor.state.doc.textContent.match(/<script\b[\s\S]*?<\/script>/gi) ?? []).map((value) => value.trim())),
  );

  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'image') return;
    const src = typeof node.attrs?.src === 'string' ? node.attrs.src : '';
    if (!src || isNonPersistableUrl(src)) return;
    const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';
    imageSnippets.push(`![${alt}](${src})`);
  });

  imageSnippets.forEach((snippet) => {
    // Presence check by URL keeps this stable even if alt text changes.
    const urlMatch = /\((.*)\)$/.exec(snippet);
    const url = urlMatch?.[1] ?? '';
    if (url && markdown.includes(url)) return;
    markdown = markdown.trim().length > 0
      ? `${markdown.trim()}\n\n${snippet}`
      : snippet;
  });

  scriptLiterals.forEach((snippet) => {
    if (!snippet || markdown.includes(snippet)) return;
    const escapedSnippet = escapeScriptTags(snippet);
    markdown = markdown.trim().length > 0
      ? `${markdown.trim()}\n\n${escapedSnippet}`
      : escapedSnippet;
  });

  const sanitized = stripNonPersistableMarkdownTargets(markdown);
  return dehydrateCommentAttachmentMarkdown(escapeScriptTags(normalizeMarkdownLinkUrls(sanitized)), attachments);
}

function isNonPersistableUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('blob:') || normalized.startsWith('data:') || normalized.startsWith('file:');
}

function stripNonPersistableMarkdownTargets(markdown: string): string {
  if (!markdown) return markdown;

  return markdown.replaceAll(
    /(!?)\[([^\]]*)\]\((<[^>]+>|[^)\s]+)(\s+["'][^"']*["'])?\)/g,
    (fullMatch, bang: string, label: string, rawDestination: string) => {
      const destination = rawDestination.replace(/^<([^>]+)>$/, '$1').trim();
      if (!isNonPersistableUrl(destination)) return fullMatch;
      return bang === '!' ? label : `[${label || destination}]`;
    },
  );
}

function normalizeMarkdownLinkUrls(markdown: string): string {
  return markdown.replaceAll(
    /\]\((<[^>]+>|[^)\s]+)(\s+["'][^"']*["'])?\)/g,
    (fullMatch, rawDestination: string, rawTitle: string | undefined) => {
      const destination = rawDestination.replace(/^<([^>]+)>$/, '$1').trim();
      const decodedDestination = (() => {
        try {
          return decodeURIComponent(destination);
        } catch {
          return destination;
        }
      })();

      const markdownWrapped = /^\[[^\]]+\]\((.+)\)$/.exec(decodedDestination)?.[1]?.trim();
      const destinationCandidate = markdownWrapped ?? decodedDestination;

      const normalized = normalizeHttpUrlInput(destinationCandidate);
      if (!normalized) return fullMatch;
      return `](${normalized}${rawTitle ?? ''})`;
    },
  );
}

function escapeMdLabel(value: string): string {
  return value
    .replaceAll('[', String.raw`\[`)
    .replaceAll(']', String.raw`\]`);
}

function buildAttachmentSnippet({ name, url, isImage }: { name: string; url: string; isImage: boolean }): string {
  const safeName = escapeMdLabel(name || 'attachment');
  return isImage
    ? `![${safeName}](${url}) `
    : `[${safeName}](${url}) `;
}

function insertSnippetAt(editor: Editor, pos: number, snippet: string): void {
  editor
    .chain()
    .focus()
    .insertContentAt(pos, snippet)
    .setTextSelection(pos + snippet.length)
    .run();
}

function buildBoardProps(boardId?: string): { boardId: string } | Record<string, never> {
  return boardId ? { boardId } : {};
}

function getDraftStatusClass(status: DraftStatus): string {
  if (status === 'will_sync_when_online') return 'text-amber-500 dark:text-amber-400';
  if (status === 'synced') return 'text-success';
  return 'text-muted';
}
function normalizeEscapedBlockquoteMarkers(markdown: string): string {
  return markdown
    .replaceAll(/^(\s*)&gt;(?=\s|$)/gm, '$1>')
    .replaceAll(/^(\s*)&amp;gt;(?=\s|$)/gm, '$1>');
}

function resolvePendingHydratedContent(pendingContent: string | null, attachments: Attachment[]): string | null {
  if (!pendingContent) return null;
  const normalized = normalizeEscapedBlockquoteMarkers(pendingContent);
  if (hasAttachmentPlaceholder(normalized) && attachments.length === 0) return null;
  const hydrated = hydrateCommentAttachmentMarkdown(normalized, attachments);
  // [why] Rewrite any legacy raw S3 URLs to the authenticated proxy path.
  return rewriteS3UrlsToProxy(hydrated, attachments);
}

function getInitialEditorContent(initialValue: string, attachments: Attachment[]): string {
  const normalized = normalizeEscapedBlockquoteMarkers(initialValue);
  if (hasAttachmentPlaceholder(normalized) && attachments.length === 0) {
    return stripCommentAttachmentPlaceholders(normalized);
  }
  const hydrated = hydrateCommentAttachmentMarkdown(normalized, attachments);
  // [why] Rewrite any legacy raw S3 URLs to the authenticated proxy path.
  return rewriteS3UrlsToProxy(hydrated, attachments);
}

function hasRenderableEditorContent(editor: Editor): boolean {
  if (editor.state.doc.textContent.trim().length > 0) return true;
  let hasImage = false;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'image') {
      hasImage = true;
      return false;
    }
    return undefined;
  });
  return hasImage;
}

function buildImageNodeFallbackDoc(markdown: string): Record<string, unknown> | null {
  if (!markdown.trim()) return null;

  const IMAGE_MARKDOWN_RE = /!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)/g;
  const paragraphNodes: Array<Record<string, unknown>> = [];
  let cursor = 0;
  let match = IMAGE_MARKDOWN_RE.exec(markdown);

  while (match) {
    const full = match[0] ?? '';
    const alt = match[1] ?? '';
    const src = match[2] ?? '';
    const index = match.index;

    const before = markdown.slice(cursor, index);
    if (before.length > 0) {
      paragraphNodes.push({ type: 'text', text: before });
    }

    if (src.trim().length > 0) {
      paragraphNodes.push({ type: 'image', attrs: { src: src.trim(), alt: alt || null } });
    }

    cursor = index + full.length;
    match = IMAGE_MARKDOWN_RE.exec(markdown);
  }

  const tail = markdown.slice(cursor);
  if (tail.length > 0) {
    paragraphNodes.push({ type: 'text', text: tail });
  }

  if (!paragraphNodes.some((node) => node.type === 'image')) return null;

  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: paragraphNodes }],
  };
}

function insertAttachmentAt(editor: Editor, attachment: Attachment, pos: number): boolean {
  const isImage = attachment.content_type?.startsWith('image/') ?? false;
  const url = resolveAttachmentMarkdownUrl(attachment, isImage);
  if (!url) return false;

  if (isImage) {
    editor
      .chain()
      .focus()
      .insertContentAt(pos, [
        {
          type: 'image',
          attrs: {
            src: url,
            alt: attachment.name,
          },
        },
        {
          type: 'text',
          text: ' ',
        },
      ])
      .setTextSelection(pos + 2)
      .run();
    return true;
  }

  // [why] Insert as a proper link node so the Link extension renders it as a
  // clickable link rather than raw markdown text.
  const displayName = attachment.alias ?? attachment.name;
  editor
    .chain()
    .focus()
    .insertContentAt(pos, [
      {
        type: 'text',
        text: displayName,
        marks: [{ type: 'link', attrs: { href: url, target: '_blank', rel: 'noopener noreferrer', class: buildLinkClassName('button'), title: buildLinkModeTitle('button') } }],
      },
      { type: 'text', text: ' ' },
    ])
    .setTextSelection(pos + displayName.length + 2)
    .run();
  return true;
}

// [why] Stable reference for the default empty attachments prop. Using an inline
// `[]` default would create a new array identity every render, causing the
// `useEffect(..., [availableAttachments])` sync to fire on every single render
// and enter a setState→re-render→setState infinite loop.
const EMPTY_ATTACHMENTS: Attachment[] = [];

const CommentEditor = ({
  boardId,
  cardId,
  availableAttachments = EMPTY_ATTACHMENTS,
  onAttachmentsChange,
  initialValue = '',
  placeholder = translations['comment.editor.placeholder'],
  onSubmit,
  onCancel,
  submitLabel = translations['comment.editor.submit'],
  insertMarkdownRef,
}: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkConfigOpen, setLinkConfigOpen] = useState(false);
  const [linkEditOpen, setLinkEditOpen] = useState(false);
  const [activeEditorLink, setActiveEditorLink] = useState<ActiveEditorLink | null>(null);
  const [hoveredLink, setHoveredLink] = useState<ActiveEditorLink | null>(null);
  const [linkEditUrl, setLinkEditUrl] = useState('');
  const [linkEditText, setLinkEditText] = useState('');
  const [cardAttachments, setCardAttachments] = useState<Attachment[]>(availableAttachments);
  const shouldRestoreDraft = initialValue.trim().length === 0 && !hasAttachmentPlaceholder(initialValue);

  // Auth + workspace context needed by the offline draft hook
  const currentUser = useSelector(selectCurrentUser);
  const token = useSelector(selectAccessToken) ?? undefined;
  const workspaceId = useSelector(selectActiveWorkspaceId) ?? undefined;

  // File picker ref for attachment uploads
  const fileInputRef = useRef<HTMLInputElement>(null);
  // [why] Track the editor position at the moment each upload was initiated so the
  // completed image/link can be inserted at the right cursor location, even when
  // the user kept typing while the upload was in-flight.
  const insertPosMap = useRef<Map<string, number>>(new Map());
  // [why] Refs break the circular dep: useAttachmentUpload onSuccess needs the editor,
  // and useEditor handleDrop needs uploadFiles. Refs are updated each render so
  // async callbacks always read the latest instance without stale-closure issues.
  const editorRef = useRef<Editor | null>(null);
  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  const linkConfigRef = useRef<HTMLDivElement | null>(null);
  const linkEditRef = useRef<HTMLDivElement | null>(null);
  const linkEditUrlInputRef = useRef<HTMLInputElement | null>(null);
  const linkEditTextInputRef = useRef<HTMLInputElement | null>(null);
  const uploadFilesRef = useRef<((files: File[]) => string[]) | null>(null);
  const cardAttachmentsRef = useRef<Attachment[]>(availableAttachments);
  const pendingHydratedContentRef = useRef<string | null>(initialValue || null);
  const pendingAttachmentInsertRef = useRef<Map<string, number>>(new Map());

  const replaceCardAttachments = useCallback((attachments: Attachment[]) => {
    cardAttachmentsRef.current = attachments;
    setCardAttachments(attachments);
  }, []);

  const prependCardAttachment = useCallback((attachment: Attachment) => {
    setCardAttachments((prev) => {
      const next = [attachment, ...prev.filter((entry) => entry.id !== attachment.id)];
      cardAttachmentsRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    replaceCardAttachments(availableAttachments);
  }, [availableAttachments, replaceCardAttachments]);

  useEffect(() => {
    onAttachmentsChange?.(cardAttachments);
  }, [cardAttachments, onAttachmentsChange]);

  // Attachment upload — only active when a cardId is provided.
  // [why] deferred=true keeps uploads queueable, while explicit flushes let us
  // upload immediately from picker/file-input flows when needed.
  const { uploads, upload: uploadFiles, removeEntry, flush: flushUploads } = useAttachmentUpload({
    cardId: cardId ?? '',
    deferred: true,
    onSuccess(attachment: Attachment, clientId: string) {
      // Prepend the newly uploaded attachment so it appears immediately in the picker
      prependCardAttachment(attachment);
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return;
      const savedPos = insertPosMap.current.get(clientId);
      insertPosMap.current.delete(clientId);
      const docSize = ed.state.doc.content.size;
      // Clamp to valid range in case the document shrank while uploading
      const insertAt = savedPos === undefined ? ed.state.selection.anchor : Math.min(savedPos, docSize);
      if (insertAttachmentAt(ed, attachment, insertAt)) return;
      // [why] Fresh upload responses can temporarily miss usable URLs for images.
      // Retry once the next attachment list fetch hydrates those URLs.
      pendingAttachmentInsertRef.current.set(attachment.id, insertAt);
    },
  });
  // Keep the ref current so the async onSuccess always reads the live editor
  uploadFilesRef.current = uploadFiles;

  // Load card attachments once (and refresh after a new upload succeeds)
  const loadCardAttachments = useCallback(async () => {
    if (!cardId) return;
    try {
      const res = await listAttachments({ cardId });
      const sorted = [...res.data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      replaceCardAttachments(sorted);
    } catch {
      // non-critical — picker will show empty list
    }
  }, [cardId, replaceCardAttachments]);

  useEffect(() => {
    void loadCardAttachments();
  }, [loadCardAttachments]);

  // Keep picker data fresh when opening so it reflects uploads made elsewhere in the card.
  useEffect(() => {
    if (!assetPickerOpen) return;
    void loadCardAttachments();
  }, [assetPickerOpen, loadCardAttachments]);

  // Offline draft integration
  const {
    restoredDraft,
    draftStatus,
    isSubmitPending,
    onContentChange: notifyDraftChange,
    handleSubmitIntent,
    clearDraft,
    retrySync,
    discardDraft,
  } = useOfflineCommentDraft({
    cardId,
    boardId,
    userId: currentUser?.id,
    workspaceId,
    token,
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      Link.configure({ openOnClick: false, enableClickSelection: true, autolink: true }),
      // [why] InlineImage now includes markdown parse/render support.
      InlineImage,
      // [why] CardReference converts pasted card URLs into interactive chip nodes.
      CardReference,
      // [why] Mention extension auto-loads for boards; skip if no boardId (edge case).
      ...(boardId ? [buildMentionExtension(boardId)] : []),
    ],
    content: getInitialEditorContent(initialValue || '', cardAttachmentsRef.current),
    contentType: 'markdown',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      notifyDraftChange(buildCommentMarkdown(editor, cardAttachmentsRef.current));
    },
    editorProps: {
      // [why] Apply prose classes directly on ProseMirror so Tailwind Typography
      // descendant selectors (.prose ul, .prose blockquote, etc.) work correctly.
      // Using [&_.ProseMirror]:prose variant only applies the root .prose properties,
      // not the child-element selectors that list/blockquote/heading styling depends on.
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none outline-none text-base',
      },
      // [why] Intercept file drops directly onto the editor so images dropped
      // anywhere in the text area are uploaded and inserted at the drop position.
      handleDrop(view, event, _slice, moved) {
        if (moved || !event.dataTransfer) return false;
        const files = Array.from(event.dataTransfer.files);
        if (files.length === 0) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const pos = coords?.pos ?? view.state.doc.content.size;
        // [why] Read from ref so this closure always calls the current uploadFiles
        // even though handleDrop was created before uploadFiles was first assigned.
        const ids = uploadFilesRef.current?.(files) ?? [];
        ids.forEach((id) => insertPosMap.current.set(id, pos));
        return true;
      },
      // [why] Clipboard image snapshots should follow the same upload + insert flow
      // as dropped files, so pasted screenshots are embedded in the comment.
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length > 0) {
          event.preventDefault();
          const pos = view.state.selection.from;
          const ids = uploadFilesRef.current?.(files) ?? [];
          ids.forEach((id) => insertPosMap.current.set(id, pos));
          void flushUploads()
            .then(() => loadCardAttachments())
            .catch(() => {
              setError(translations['comment.editor.error.uploadFailed']);
            });
          return true;
        }

        const clipboardText = event.clipboardData?.getData('text/plain')?.trim() ?? '';

        if (/<script\b[^>]*>|<\/script>/i.test(clipboardText)) {
          event.preventDefault();
          const pos = view.state.selection.from;
          const escapedText = escapeScriptTags(clipboardText);
          editorRef.current
            ?.chain()
            .focus()
            .insertContentAt(pos, [{ type: 'text', text: escapedText }])
            .setTextSelection(pos + escapedText.length)
            .run();
          return true;
        }

        const href = normalizeHttpUrlInput(clipboardText);
        if (!href) return false;

        event.preventDefault();
        const pos = view.state.selection.from;

        const loadingToken = `link-loading-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
        const loadingClass = buildLinkClassName('url', [LINK_CLASS_LOADING, loadingToken]);

        editorRef.current
          ?.chain()
          .focus()
          .insertContentAt(pos, [
            {
              type: 'text',
              text: href,
              marks: [{ type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer', class: loadingClass, title: buildLinkModeTitle('url') } }],
            },
            { type: 'text', text: ' ' },
          ])
          .setTextSelection(pos + href.length + 1)
          .run();

        void (async () => {
          let inlineTitle = getInlineTitleFromUrl(href);
          try {
            const preview = await fetchLinkPreview({ url: href });
            if (preview.data.title.trim()) {
              inlineTitle = preview.data.title.trim();
            }
          } catch {
            // Keep inlineTitle fallback.
          }

          const ed = editorRef.current;
          if (!ed || ed.isDestroyed) return;

          const loadingRange = findLinkRangeByClassToken(ed, loadingToken);
          if (!loadingRange) return;

          replaceLinkRangeText(ed, loadingRange, inlineTitle || href, buildLinkClassName('button'));
        })();
        return true;
      },
      // [why] In editable mode, clicking links should select them for editing,
      // not navigate away from the page.
      handleDOMEvents: {
        click(view, event) {
          const target = event.target as HTMLElement | null;
          const anchor = target?.closest('a');
          if (!anchor) return false;

          event.preventDefault();

          const from = view.posAtDOM(anchor, 0);
          const linkTextLength = Math.max(anchor.textContent?.length ?? 0, 1);
          const to = Math.min(from + linkTextLength, view.state.doc.content.size);

          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
          view.focus();
          return true;
        },
      },
    },
  });
  // Keep editorRef current so the async onSuccess always reads the live editor
  editorRef.current = editor;

  // [why] Expose a stable insert function via ref so external callers (e.g. AttachmentPanel
  // Comment action) can insert markdown at the current cursor without re-rendering.
  useEffect(() => {
    if (!insertMarkdownRef) return;
    insertMarkdownRef.current = (md: string) => {
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return;
      const pos = ed.state.selection.anchor;
      // [why] Parse [label](url) markdown so it inserts as a proper link node
      // rather than raw text — the Link extension renders it correctly this way.
      const linkMatch = /^\[(.+?)\]\((.+?)\)\s*$/.exec(md);
      if (linkMatch) {
        const [, text, href] = linkMatch;
        ed.chain()
          .focus()
          .insertContentAt(pos, [
            {
              type: 'text',
              text,
              marks: [{ type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer', class: buildLinkClassName('button'), title: buildLinkModeTitle('button') } }],
            },
            { type: 'text', text: ' ' },
          ])
          .setTextSelection(pos + text.length + 2)
          .run();
        return;
      }
      insertSnippetAt(ed, pos, md);
    };
    return () => {
      // Clear on unmount so stale refs don't leak
      if (insertMarkdownRef.current) insertMarkdownRef.current = null;
    };
  // [why] insertMarkdownRef identity is stable (ref object), so this runs once on mount/unmount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertMarkdownRef]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    hydrateEditorLinkMarkClasses(editor);
  }, [editor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const pendingContent = pendingHydratedContentRef.current;
    const hydratedContent = resolvePendingHydratedContent(
      pendingContent,
      cardAttachmentsRef.current,
    );
    if (!hydratedContent) return;
    editor.commands.setContent(hydratedContent, { contentType: 'markdown' });
    if (!hasRenderableEditorContent(editor) && pendingContent && pendingContent.trim().length > 0) {
      const imageFallbackDoc = buildImageNodeFallbackDoc(hydratedContent);
      if (imageFallbackDoc) {
        editor.commands.setContent(imageFallbackDoc);
      }
    }
    if (!hasRenderableEditorContent(editor) && pendingContent && pendingContent.trim().length > 0) {
      const fallbackText = stripCommentAttachmentPlaceholders(
        normalizeEscapedBlockquoteMarkers(pendingContent),
      ).trim();
      if (fallbackText.length > 0) {
        editor.commands.setContent({
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: fallbackText }],
          }],
        });
      }
    }
    hydrateEditorLinkMarkClasses(editor);
    pendingHydratedContentRef.current = null;
  }, [editor, cardAttachments, restoredDraft]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed || pendingAttachmentInsertRef.current.size === 0) return;

    pendingAttachmentInsertRef.current.forEach((pos, attachmentId) => {
      const attachment = cardAttachmentsRef.current.find((entry) => entry.id === attachmentId);
      if (!attachment) return;
      if (!insertAttachmentAt(ed, attachment, Math.min(pos, ed.state.doc.content.size))) return;
      pendingAttachmentInsertRef.current.delete(attachmentId);
    });
  }, [cardAttachments]);

  // Restore offline draft into editor once it's loaded (async, after initial render)
  useEffect(() => {
    if (!shouldRestoreDraft || !restoredDraft) return;
    pendingHydratedContentRef.current = restoredDraft;
  // [why] Only restore when the draft first becomes available — not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredDraft, shouldRestoreDraft]);

  const handleSubmit = useCallback(async () => {
    if (!editor) return;
    const trimmed = buildCommentMarkdown(editor, cardAttachmentsRef.current).trim();
    if (!trimmed) {
      setError(translations['comment.editor.error.empty']);
      return;
    }
    setError(null);

    // Offline path: queue POST and show "Will post when back online"
    const handledOffline = handleSubmitIntent(trimmed);
    if (handledOffline) return;

    // Online path: flush any queued (deferred) attachments first, then submit.
    setSubmitting(true);
    try {
      // [why] Deferred uploads haven't started yet — flush() triggers them all and
      // waits for completion so onSuccess inserts the attachment URLs into the editor
      // before we read the final markdown to post.
      await flushUploads();
      await onSubmit(buildCommentMarkdown(editor, cardAttachmentsRef.current).trim());
      editor.commands.clearContent();
      clearDraft();
    } catch {
      setError(translations['comment.editor.error.saveFailed']);
    } finally {
      setSubmitting(false);
    }
  }, [editor, onSubmit, handleSubmitIntent, clearDraft, flushUploads]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape' && onCancel) {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSubmit, onCancel],
  );

  // Toggle the asset picker (file upload + existing card assets)
  const handleAttach = useCallback(() => {
    if (!cardId) return;
    // Focus editor to lock in the cursor position before the picker opens
    if (editor && !editor.isDestroyed) {
      editor.commands.focus();
    }
    setLinkConfigOpen(false);
    setLinkEditOpen(false);
    setActiveEditorLink(null);
    setHoveredLink(null);
    setLinkPopoverOpen(false);
    setAssetPickerOpen((prev) => !prev);
  }, [cardId, editor]);

  // Insert an existing card attachment at the current cursor position
  const handleInsertExisting = useCallback(
    (attachment: Attachment) => {
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return;
      insertAttachmentAt(ed, attachment, ed.state.selection.anchor);
    },
    [],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) {
        const pos = editor && !editor.isDestroyed
          ? editor.state.selection.anchor
          : 0;
        const ids = uploadFiles(files);
        ids.forEach((id) => insertPosMap.current.set(id, pos));

        // Start deferred uploads right away so newly uploaded files show up in
        // the insert-attachment picker without waiting for comment submit.
        void flushUploads()
          .then(() => loadCardAttachments())
          .catch(() => setError(translations['comment.editor.error.uploadFailed']));
      }
      e.target.value = '';
    },
    [editor, uploadFiles, flushUploads, loadCardAttachments],
  );

  const getEditorLinkFromTarget = useCallback((target: EventTarget | null): ActiveEditorLink | null => {
    if (!editor) return null;
    const element = target as HTMLElement | null;
    if (!element) return null;
    const anchor = element.closest('a');
    if (!(anchor instanceof HTMLAnchorElement)) return null;
    if (!anchor.closest('.ProseMirror')) return null;
    return findActiveLinkFromAnchor(editor, anchor);
  }, [editor]);

  const updateStoredLinkRect = useCallback((link: ActiveEditorLink | null): ActiveEditorLink | null => {
    if (!link) return null;
    if (link.anchorEl?.isConnected) {
      return { ...link, rect: link.anchorEl.getBoundingClientRect() };
    }
    const fromCoords = editor?.view.coordsAtPos(link.from);
    const toCoords = editor?.view.coordsAtPos(Math.max(link.from + 1, link.to));
    if (!fromCoords || !toCoords) return link;
    const left = Math.min(fromCoords.left, toCoords.left);
    const top = Math.min(fromCoords.top, toCoords.top);
    const right = Math.max(fromCoords.right, toCoords.right);
    const bottom = Math.max(fromCoords.bottom, toCoords.bottom);
    return {
      ...link,
      rect: new DOMRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top)),
    };
  }, [editor]);

  const closeLinkConfigUi = useCallback(() => {
    setLinkConfigOpen(false);
    setLinkEditOpen(false);
    setActiveEditorLink(null);
    setHoveredLink(null);
  }, []);

  const applyLinkChange = useCallback((payload: {
    href: string;
    displayMode: LinkDisplayMode;
    baseLabel?: string;
    openEdit?: boolean;
  }) => {
    if (!editor || !activeEditorLink) return;

    const normalizedHref = normalizeHttpUrlInput(payload.href) ?? payload.href.trim();
    if (!normalizedHref) return;

    let text = payload.baseLabel?.trim() || getLinkLabelText(activeEditorLink.text);
    if (!text) {
      text = getInlineTitleFromUrl(normalizedHref);
    }

    if (payload.displayMode === 'card') {
      text = buildCardLinkText(text, normalizedHref);
    } else if (payload.displayMode === 'url' && !payload.baseLabel?.trim()) {
      // [why] URL mode should accept custom display text when provided.
      text = normalizedHref;
    }

    const linkClass = buildLinkClassName(payload.displayMode);

    const attrs = {
      href: normalizedHref,
      target: '_blank',
      rel: 'noopener noreferrer',
      class: linkClass,
      title: buildLinkModeTitle(payload.displayMode),
    };

    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: activeEditorLink.from, to: activeEditorLink.to },
        {
          type: 'text',
          text,
          marks: [{ type: 'link', attrs }],
        },
      )
      .setTextSelection(activeEditorLink.from + text.length)
      .run();

    const updatedLink = findActiveLinkFromSelection(editor)
      ?? (activeEditorLink.anchorEl ? findActiveLinkFromAnchor(editor, activeEditorLink.anchorEl) : null);
    if (updatedLink) {
      setActiveEditorLink(updatedLink);
      setHoveredLink(updatedLink);
    } else {
      setActiveEditorLink((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          href: normalizedHref,
          text,
          mode: payload.displayMode,
        };
      });
    }

    if (!payload.openEdit) {
      setLinkEditOpen(false);
    }
  }, [editor, activeEditorLink]);

  const commitLinkEdit = useCallback(() => {
    if (!activeEditorLink) return;
    const nextHref = linkEditUrlInputRef.current?.value ?? linkEditUrl;
    const nextLabel = linkEditTextInputRef.current?.value ?? linkEditText;
    applyLinkChange({
      href: nextHref,
      displayMode: activeEditorLink.mode,
      baseLabel: nextLabel,
      openEdit: true,
    });
    setLinkEditOpen(false);
  }, [activeEditorLink, applyLinkChange, linkEditUrl, linkEditText]);

  const linkOverlayTarget = (linkConfigOpen ? activeEditorLink : hoveredLink) ?? null;
  const linkOverlayPosition = (() => {
    if (!linkOverlayTarget) return null;
    const container = editorScrollRef.current;
    if (!container) return null;
    const containerRect = container.getBoundingClientRect();
    const left = Math.max(8, Math.min(
      linkOverlayTarget.rect.right - containerRect.left - 12,
      containerRect.width - 32,
    ));
    const iconSize = 24;
    const centeredTop = linkOverlayTarget.rect.top - containerRect.top
      + ((linkOverlayTarget.rect.height - iconSize) / 2);
    const top = Math.max(6, centeredTop);
    return { left, top };
  })();

  const linkConfigPosition = (() => {
    if (!activeEditorLink) return null;
    const container = editorScrollRef.current;
    if (!container) return null;
    const containerRect = container.getBoundingClientRect();
    const toolbarHeight = 40;
    const gap = 10;
    const left = Math.max(8, Math.min(
      activeEditorLink.rect.left - containerRect.left,
      containerRect.width - 296,
    ));

    const linkTop = activeEditorLink.rect.top - containerRect.top;
    const linkBottom = activeEditorLink.rect.bottom - containerRect.top;
    const belowTop = linkBottom + gap;
    const aboveTop = linkTop - toolbarHeight - gap;

    const canPlaceBelow = belowTop + toolbarHeight <= container.clientHeight - 8;
    const canPlaceAbove = aboveTop >= 8;

    let top = belowTop;
    if (canPlaceAbove && !canPlaceBelow) {
      top = aboveTop;
    } else if (canPlaceAbove && canPlaceBelow) {
      const spaceAbove = linkTop;
      const spaceBelow = container.clientHeight - linkBottom;
      top = spaceAbove > spaceBelow ? aboveTop : belowTop;
    }

    top = Math.max(8, Math.min(top, container.clientHeight - toolbarHeight - 8));
    return { left, top };
  })();

  useEffect(() => {
    if (!linkConfigOpen && !linkEditOpen) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (linkConfigRef.current?.contains(target) || linkEditRef.current?.contains(target)) {
        return;
      }

      closeLinkConfigUi();
    };

    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
    };
  }, [linkConfigOpen, linkEditOpen, closeLinkConfigUi]);

  useEffect(() => {
    const refreshRects = () => {
      setHoveredLink((prev) => updateStoredLinkRect(prev));
      setActiveEditorLink((prev) => updateStoredLinkRect(prev));
    };

    window.addEventListener('resize', refreshRects);
    return () => {
      window.removeEventListener('resize', refreshRects);
    };
  }, [updateStoredLinkRect]);

  const currentMarkdown = editor ? buildCommentMarkdown(editor, cardAttachmentsRef.current) : '';

  return (
    <div className="flex w-full min-w-0 flex-col gap-2" data-upload-drop-exclude="true">
      {/* Hidden file input for attachment upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.zip,.tar,.gz,audio/*"
        className="hidden"
        onChange={handleFileInputChange}
        data-testid="comment-attachment-input"
      />

      {/* Draft recovery banner — shown when a draft was restored from local/server storage */}
      {shouldRestoreDraft && restoredDraft && draftStatus !== 'idle' && (
        <div
          data-testid="comment-draft-recovery-banner"
          className="flex items-center justify-between rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300"
        >
          <span>
            {draftStatus === 'will_sync_when_online'
              ? translations['comment.draft.unsavedOffline']
              : translations['comment.draft.unsaved']}
          </span>
          <button
            type="button"
            className="ml-4 text-muted hover:text-subtle underline transition-colors"
            onClick={discardDraft}
            data-testid="comment-draft-discard"
          >
            {translations['comment.draft.discard']}
          </button>
        </div>
      )}

      <div
        className="w-full min-w-0 rounded-lg border border-border bg-bg-base overflow-visible focus-within:ring-2 focus-within:ring-blue-400"
        onKeyDown={handleKeyDown}
      >
        {/* Single-line toolbar — never wraps */}
        {/* [why] relative wrapper anchors the CardAssetPicker popover to the toolbar row */}
        <div className="relative">
          <OneLineToolbar
            editor={editor}
            overflowOpen={overflowOpen}
            onToggleOverflow={() => setOverflowOpen((o) => !o)}
            linkPopoverOpen={linkPopoverOpen}
            onToggleLinkPopover={() => {
              setAssetPickerOpen(false);
              closeLinkConfigUi();
              setLinkPopoverOpen((v) => !v);
            }}
            {...(cardId ? { onAttach: handleAttach } : {})}
          />
          {linkPopoverOpen && (
            <LinkInsertPopover
              editor={editor}
              onClose={() => setLinkPopoverOpen(false)}
            />
          )}
          {assetPickerOpen && cardId && (
            <CardAssetPicker
              attachments={cardAttachments}
              onUploadNew={() => fileInputRef.current?.click()}
              onInsert={handleInsertExisting}
              onClose={() => setAssetPickerOpen(false)}
            />
          )}
        </div>
        <div
          ref={editorScrollRef}
          className="relative"
          onMouseDownCapture={(event) => {
            const next = getEditorLinkFromTarget(event.target);
            if (!next) return;
            event.preventDefault();
            event.stopPropagation();
            setLinkPopoverOpen(false);
            setAssetPickerOpen(false);
            setActiveEditorLink(next);
            setHoveredLink(next);
            setLinkConfigOpen(true);
            setLinkEditOpen(false);
          }}
          onScroll={() => {
            setHoveredLink((prev) => updateStoredLinkRect(prev));
            setActiveEditorLink((prev) => updateStoredLinkRect(prev));
          }}
          onMouseMove={(event) => {
            if (linkConfigOpen) return;
            const next = getEditorLinkFromTarget(event.target);
            setHoveredLink(next);
          }}
          onMouseLeave={() => {
            if (!linkConfigOpen) {
              setHoveredLink(null);
            }
          }}
          onClickCapture={(event) => {
            const next = getEditorLinkFromTarget(event.target);
            if (!next) return;
            event.preventDefault();
            event.stopPropagation();
            setLinkPopoverOpen(false);
            setAssetPickerOpen(false);
            setActiveEditorLink(next);
            setHoveredLink(next);
            setLinkConfigOpen(true);
            setLinkEditOpen(false);
          }}
        >
          <EditorContent
            editor={editor}
            aria-label={translations['comment.editor.ariaLabel']}
            aria-placeholder={placeholder}
            className="px-3 py-2 text-sm [&_.ProseMirror]:min-h-[72px] [&_.ProseMirror>*:first-child]:mt-0 [&_.ProseMirror>*:last-child]:mb-0"
          />

          {linkOverlayPosition && linkOverlayTarget && !linkEditOpen && (
            <button
              type="button"
              aria-label={translations['comment.link.displayFullUrlAria']}
              title={translations['comment.link.displayFullUrlTitle']}
              className="absolute z-30 inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-bg-base text-muted shadow-sm hover:text-base"
              style={{ left: linkOverlayPosition.left, top: linkOverlayPosition.top }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setLinkPopoverOpen(false);
                setAssetPickerOpen(false);
                setActiveEditorLink(linkOverlayTarget);
                setHoveredLink(linkOverlayTarget);
                setLinkConfigOpen(true);
                setLinkEditOpen(false);
              }}
            >
              <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}

          {linkConfigOpen && activeEditorLink && linkConfigPosition && (
            <div
              ref={linkConfigRef}
              className="absolute z-40 flex h-10 items-center gap-1 rounded-lg border border-border bg-bg-base px-1.5 shadow-2xl"
              style={{ left: linkConfigPosition.left, top: linkConfigPosition.top }}
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
            >
              <div className="mr-1 inline-flex items-center gap-0.5 rounded-md border border-border bg-bg-overlay p-0.5">
                <button
                  type="button"
                  title="Display full URL"
                  aria-label="Display full URL"
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${activeEditorLink.mode === 'url' ? 'bg-indigo-600 text-inverse' : 'text-muted hover:bg-bg-base hover:text-base'}`}
                  onClick={() => {
                    applyLinkChange({ href: activeEditorLink.href, displayMode: 'url' });
                  }}
                >
                  <MinusIcon className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  title="Display as button"
                  aria-label={translations['comment.link.displayAsButtonAria']}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${activeEditorLink.mode === 'button' ? 'bg-indigo-600 text-inverse' : 'text-muted hover:bg-bg-base hover:text-base'}`}
                  onClick={() => {
                    applyLinkChange({
                      href: activeEditorLink.href,
                      displayMode: 'button',
                      baseLabel: getLinkLabelText(activeEditorLink.text),
                    });
                  }}
                >
                  <LinkIcon className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  title="Display as card"
                  aria-label={translations['comment.link.displayAsCardAria']}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${activeEditorLink.mode === 'card' ? 'bg-indigo-600 text-inverse' : 'text-muted hover:bg-bg-base hover:text-base'}`}
                  onClick={() => {
                    applyLinkChange({
                      href: activeEditorLink.href,
                      displayMode: 'card',
                      baseLabel: getLinkLabelText(activeEditorLink.text) || getInlineTitleFromUrl(activeEditorLink.href),
                    });
                  }}
                >
                  <RectangleStackIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                title="Edit link"
                aria-label="Edit link"
                className="inline-flex h-8 items-center rounded-md px-2 text-sm font-medium text-base hover:bg-bg-overlay"
                onClick={() => {
                  const initialLabel = getLinkLabelText(activeEditorLink.text);
                  setLinkEditUrl(activeEditorLink.href);
                  setLinkEditText(initialLabel);
                  setLinkEditOpen(true);
                }}
              >
                Edit link
              </button>

              <button
                type="button"
                title="Open Link In New Tab"
                aria-label={translations['comment.link.openInNewTabAria']}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-overlay hover:text-base"
                onClick={() => {
                  const normalized = normalizeHttpUrlInput(activeEditorLink.href) ?? activeEditorLink.href;
                  window.open(normalized, '_blank', 'noopener,noreferrer');
                }}
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                title="Copy link"
                aria-label={translations['comment.link.copyAria']}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-overlay hover:text-base"
                onClick={() => {
                  void navigator.clipboard.writeText(activeEditorLink.href);
                }}
              >
                <ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                title="Delete link"
                aria-label={translations['comment.link.deleteTitle']}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-danger hover:bg-bg-overlay"
                onClick={() => {
                  if (!editor) return;
                  editor
                    .chain()
                    .focus()
                    .setTextSelection({ from: activeEditorLink.from, to: activeEditorLink.to })
                    .unsetLink()
                    .run();
                  closeLinkConfigUi();
                }}
              >
                <TrashIcon className="h-4 w-4" aria-hidden="true" />
              </button>

              <div className="w-0.5" aria-hidden="true" />
            </div>
          )}

          {linkConfigOpen && linkEditOpen && activeEditorLink && linkConfigPosition && (
            <div
              ref={linkEditRef}
              className="absolute z-50 w-80 rounded-xl border border-border bg-bg-base p-3 shadow-2xl"
              style={{
                left: Math.min(linkConfigPosition.left + 12, Math.max(8, (editorScrollRef.current?.clientWidth ?? 380) - 328)),
                top: linkConfigPosition.top + 44,
              }}
            >
              <div className="space-y-2">
                <input
                  ref={linkEditUrlInputRef}
                  type="url"
                  value={linkEditUrl}
                  onChange={(event) => {
                    setLinkEditUrl(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    commitLinkEdit();
                  }}
                  placeholder={translations['comment.link.displayTextPlaceholder']}
                  className="w-full rounded-md border border-border bg-bg-overlay px-2.5 py-2 text-sm text-base outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  ref={linkEditTextInputRef}
                  type="text"
                  value={linkEditText}
                  onChange={(event) => {
                    setLinkEditText(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    commitLinkEdit();
                  }}
                  placeholder="Display text (optional)"
                  className="w-full rounded-md border border-border bg-bg-overlay px-2.5 py-2 text-sm text-base outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </div>
        {editor && <CardReferenceBubbleMenu editor={editor} />}

        {/* Inline upload previews — shown while files are in-flight */}
        {uploads.length > 0 && (
          <div
            aria-label={translations['comment.editor.uploads.ariaLabel']}
            className="flex flex-col gap-1 border-t border-border p-2"
          >
            {uploads.map((entry) => (
              <InlineUploadPreview
                key={entry.clientId}
                entry={entry}
                onCancel={removeEntry}
              />
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {/* Draft status footer */}
      {draftStatus !== 'idle' && (
        <div
          data-testid="comment-draft-status-footer"
          className="flex items-center gap-2 text-[11px]"
        >
          {draftStatus === 'sync_failed' ? (
            <>
              <span className="text-danger">
                {isSubmitPending ? translations['comment.draft.postFailed'] : translations['comment.draft.syncFailed']}
              </span>
              <button
                type="button"
                className="text-indigo-400 hover:text-indigo-300 underline transition-colors"
                onClick={() => retrySync(currentMarkdown)}
                data-testid="comment-draft-retry-sync"
              >
                {/* [why] "Retry Post" clarifies the user's pending action vs a background sync retry */}
                {isSubmitPending ? translations['comment.draft.retryPost'] : translations['comment.draft.retry']}
              </button>
              <button
                type="button"
                className="text-muted hover:text-subtle underline transition-colors"
                onClick={discardDraft}
                data-testid="comment-draft-discard-footer"
              >
                {translations['comment.draft.discardFooter']}
              </button>
            </>
          ) : (
            <span className={getDraftStatusClass(draftStatus)}>
              {isSubmitPending && draftStatus === 'will_sync_when_online'
                ? translations['comment.draft.willSync']
                : draftStatusLabel(draftStatus)}
            </span>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? translations['comment.editor.submitting'] : submitLabel}
        </Button>
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
          >
            {translations['comment.editor.cancel']}
          </Button>
        )}
      </div>
    </div>
  );
};

export default CommentEditor;

