// CardDescriptionTiptap — rich text markdown editor using Tiptap with offline draft support.
import { useState, useEffect, useCallback, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Markdown } from '@tiptap/markdown';
import type { Editor } from '@tiptap/react';
import { getMarkRange } from '@tiptap/core';
import { marked } from 'marked';
import { useSelector } from 'react-redux';
import {
  AdjustmentsHorizontalIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  LinkIcon,
  MinusIcon,
  RectangleStackIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import OneLineToolbar from './OneLineToolbar';
import LinkInsertPopover from './LinkInsertPopover';
import Button from '../../../common/components/Button';
import type { Attachment } from '~/extensions/Attachments/types';
import { useAttachmentUpload } from '~/extensions/Attachments/hooks/useAttachmentUpload';
import { InlineUploadPreview } from '~/extensions/Attachments/components/InlineUploadPreview';
import { ImageLightbox } from '~/extensions/Attachments/components/AttachmentThumbnail';
import { CardAssetPicker } from '~/extensions/Comment/components/CardAssetPicker';
import { fetchLinkPreview, listAttachments } from '~/extensions/Attachments/api';
import InlineImage from '~/extensions/Comment/extensions/InlineImage';
import { buildMentionExtension } from '~/extensions/Mention/TiptapMentionExtension';
import CardReference from '../extensions/CardReferenceExtension';
import CardReferenceBubbleMenu from './CardReferenceBubbleMenu';
import {
  dehydrateCommentAttachmentMarkdown,
  hasAttachmentPlaceholder,
  hydrateCommentAttachmentMarkdown,
  readAttachmentPlaceholderName,
  resolveAttachmentMarkdownUrl,
  stripCommentAttachmentPlaceholders,
} from '~/common/utils/attachmentMarkdown';
import { rewriteS3UrlsToProxy } from '~/common/utils/rewriteS3UrlsToProxy';
import {
  useOfflineDescriptionDraft,
  type DraftStatus,
} from '~/extensions/OfflineDrafts/hooks/useOfflineDescriptionDraft';
import { selectCurrentUser, selectAccessToken } from '~/slices/authSlice';
import { selectActiveWorkspaceId } from '~/extensions/Workspace/duck/workspaceDuck';
import { getInlineTitleFromUrl, normalizeHttpUrlInput } from '~/common/utils/urlDisplayText';
import { sanitizeUserGeneratedHtml } from '~/common/utils/sanitizeUserGeneratedHtml';
import { escapeScriptTags } from '~/common/utils/escapeScriptTags';

/**
 * Add target="_blank" rel="noopener noreferrer" to external links that don't already
 * have a target attribute and whose href is not a bare anchor (#...).
 * [why] marked.parse() output does not carry Tiptap's Link extension HTMLAttributes,
 * so the preview HTML needs this post-processing pass.
 */
function addLinkTargetBlank(html: string): string {
  return html.replaceAll(
    /<a(?=[^>]*\bhref="(?!#))(?![^>]*\btarget=)/gi,
    '<a target="_blank" rel="noopener noreferrer"',
  );
}

function normalizePreviewLinkHref(rawHref: string): string {
  const trimmed = rawHref.trim();
  const decoded = (() => {
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  })();

  // [why] Some markdown round-trips can leave a markdown token in href (e.g.
  // [label](url)) and occasionally this arrives percent-encoded.
  const markdownHrefMatch = /^\[[^\]]+\]\((.+)\)$/.exec(decoded);
  const hrefCandidate = (markdownHrefMatch?.[1] ?? decoded).trim();
  const unwrapped = hrefCandidate.replace(/^<([^>]+)>$/, '$1').trim();

  const embeddedUrls = Array.from(unwrapped.matchAll(/https?:\/\/[^\s<>)\]]+/gi)).map((match) => match[0]);
  const bestEmbeddedUrl = (() => {
    if (embeddedUrls.length === 0) return null;

    const currentHost = globalThis.location.hostname.toLowerCase();
    const pick = [...embeddedUrls].reverse().find((value) => {
      try {
        const parsed = new URL(value);
        const host = parsed.hostname.toLowerCase();
        if (host === currentHost) return false;
        if (host === 'localhost' || host === '127.0.0.1') return false;
        return true;
      } catch {
        return false;
      }
    });

    return pick ?? embeddedUrls.at(-1) ?? null;
  })();

  const normalized = normalizeHttpUrlInput(bestEmbeddedUrl ?? unwrapped);
  return normalized ?? unwrapped;
}

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

function detectLinkDisplayMode(
  className: string | null | undefined,
  text: string,
  title?: string | null,
  hasVisualLineBreak = false,
): LinkDisplayMode {
  const modeFromMetadata = getModeFromClassName(className);
  if (modeFromMetadata) return modeFromMetadata;

  const modeFromTitle = getModeFromTitle(title);
  if (modeFromTitle) return modeFromTitle;

  if (className?.includes(LINK_CLASS_URL)) return 'url';
  if (className?.includes(LINK_CLASS_CARD) || hasVisualLineBreak || text.includes('\n')) return 'card';
  // [why] Default link presentation in edit mode should be the compact button
  // style, not raw URL text mode.
  if (className?.includes(LINK_CLASS_BUTTON)) return 'button';
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

function classifyPreviewLinkMode(anchor: HTMLAnchorElement): LinkDisplayMode {
  const metadataMode = getModeFromClassName(anchor.getAttribute('class'));
  if (metadataMode) return metadataMode;

  const modeFromTitle = getModeFromTitle(anchor.getAttribute('title'));
  if (modeFromTitle) return modeFromTitle;

  if (anchor.querySelector('br')) return 'card';

  const href = anchor.getAttribute('href')?.trim() ?? '';
  const text = anchor.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
  if (!href || !text) return 'button';

  const normalizedHref = normalizeComparableUrl(href);
  const normalizedText = normalizeComparableUrl(text);
  if (normalizedHref.length > 0 && normalizedHref === normalizedText) return 'url';

  return 'button';
}

function hydratePreviewLinkModes(root: HTMLElement): void {
  const anchors = Array.from(root.querySelectorAll('a[href]')) as HTMLAnchorElement[];
  anchors.forEach((anchor) => {
    anchor.classList.remove(
      'meta-link-chip',
      LINK_CLASS_URL,
      LINK_CLASS_BUTTON,
      LINK_CLASS_CARD,
      LINK_MODE_META_URL,
      LINK_MODE_META_BUTTON,
      LINK_MODE_META_CARD,
    );

    const mode = classifyPreviewLinkMode(anchor);
    const nextClassTokens = buildLinkClassName(mode).split(/\s+/).filter(Boolean);
    anchor.classList.add(...nextClassTokens);
  });
}

function mergeConsecutiveDuplicateHrefLinks(root: ParentNode): void {
  const anchors = Array.from(root.querySelectorAll('a[href]')) as HTMLAnchorElement[];
  anchors.forEach((anchor) => {
    if (!anchor.isConnected) return;

    let separator: Node | null = anchor.nextSibling;
    while (separator && separator.nodeType === Node.TEXT_NODE && !(separator.textContent ?? '').trim()) {
      separator = separator.nextSibling;
    }

    const hadBrSeparator = separator instanceof HTMLBRElement;
    let nextNode: Node | null = separator;
    if (hadBrSeparator) {
      nextNode = separator.nextSibling;
      while (nextNode && nextNode.nodeType === Node.TEXT_NODE && !(nextNode.textContent ?? '').trim()) {
        nextNode = nextNode.nextSibling;
      }
    }

    if (!(nextNode instanceof HTMLAnchorElement)) return;

    const leftHref = normalizeComparableUrl(anchor.getAttribute('href') ?? '');
    const rightHref = normalizeComparableUrl(nextNode.getAttribute('href') ?? '');
    if (!leftHref || leftHref !== rightHref) return;

    const firstText = anchor.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
    const secondText = nextNode.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
    if (!firstText || !secondText) return;

    anchor.textContent = '';
    anchor.append(document.createTextNode(firstText));
    anchor.append(document.createElement('br'));
    anchor.append(document.createTextNode(secondText));
    anchor.classList.remove(
      'meta-link-chip',
      LINK_CLASS_URL,
      LINK_CLASS_BUTTON,
      LINK_MODE_META_URL,
      LINK_MODE_META_BUTTON,
      LINK_MODE_META_CARD,
    );
    anchor.classList.add(LINK_CLASS_CARD, LINK_MODE_META_CARD);

    if (hadBrSeparator && separator instanceof HTMLBRElement) {
      separator.remove();
    }
    nextNode.remove();
  });
}

function normalizeRenderedLinkHtml(html: string): string {
  if (!html || !/<a\b/i.test(html)) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const anchors = Array.from(doc.body.querySelectorAll('a[href]'));
  anchors.forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (!href) return;
    const normalizedHref = normalizePreviewLinkHref(href);
    if (normalizedHref && normalizedHref !== href) {
      anchor.setAttribute('href', normalizedHref);
    }
  });
  mergeConsecutiveDuplicateHrefLinks(doc.body);
  return doc.body.innerHTML;
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

  const mode = detectLinkDisplayMode(className, text, title, Boolean(anchorEl?.querySelector('br')));

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
  boardId: string;
  cardId?: string;
  description: string;
  onSave: (description: string) => void;
  disabled?: boolean;
}

// Map draft status to a human-readable footer label.
function draftStatusLabel(status: DraftStatus): string | null {
  switch (status) {
    case 'saving_local': return 'Saving draft…';
    case 'saved_local':  return 'Draft saved locally';
    case 'syncing':      return 'Syncing draft…';
    case 'synced':       return 'Synced draft';
    case 'will_sync_when_online': return 'Will sync when online';
    case 'sync_failed':  return 'Sync failed';
    default:             return null;
  }
}

// [why] Tiptap's Markdown extension HTML-encodes blockquote markers as &gt; (and
// double-encodes them as &amp;gt; after round-trips). Normalise them back to bare
// `>` so marked.parse() renders them as <blockquote> elements.
function normalizeEscapedBlockquoteMarkers(markdown: string): string {
  return markdown
    .replaceAll(/^(\s*)&gt;(?=\s|$)/gm, '$1>')
    .replaceAll(/^(\s*)&amp;gt;(?=\s|$)/gm, '$1>');
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

      // [why] Some drafts can accidentally store markdown tokens in the
      // destination position, e.g. ]([Label](https://...)). Unwrap so the
      // anchor href is a plain URL (important for native browser open-in-new-tab).
      const markdownWrapped = /^\[[^\]]+\]\((.+)\)$/.exec(decodedDestination)?.[1]?.trim();
      const destinationCandidate = markdownWrapped ?? decodedDestination;

      const normalized = normalizeHttpUrlInput(destinationCandidate);
      if (!normalized) return fullMatch;
      return `](${normalized}${rawTitle ?? ''})`;
    },
  );
}

function buildDescriptionMarkdown(editor: Editor, attachments: Attachment[]): string {
  let markdown = normalizeEscapedBlockquoteMarkers(editor.getMarkdown() || '');
  const imageSnippets: string[] = [];
  const scriptLiterals = Array.from(
    new Set((editor.state.doc.textContent.match(/<script\b[\s\S]*?<\/script>/gi) ?? []).map((value) => value.trim())),
  );

  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'image') return;
    const src = typeof node.attrs?.src === 'string' ? node.attrs.src : '';
    if (!src) return;
    const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';
    imageSnippets.push(`![${alt}](${src})`);
  });

  imageSnippets.forEach((snippet) => {
    const urlMatch = /\((.*)\)$/.exec(snippet);
    const url = urlMatch?.[1] ?? '';
    if (url && markdown.includes(url)) return;
    markdown = markdown.trim().length > 0
      ? `${markdown.trim()}\n\n${snippet}`
      : snippet;
  });

  markdown = normalizeMarkdownLinkUrls(markdown);

  scriptLiterals.forEach((snippet) => {
    if (!snippet || markdown.includes(snippet)) return;
    const escapedSnippet = escapeScriptTags(snippet);
    markdown = markdown.trim().length > 0
      ? `${markdown.trim()}\n\n${escapedSnippet}`
      : escapedSnippet;
  });

  return dehydrateCommentAttachmentMarkdown(escapeScriptTags(markdown), attachments);
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

function resolvePendingHydratedContent(pendingContent: string | null, attachments: Attachment[]): string | null {
  if (!pendingContent) return null;
  const normalized = normalizeEscapedBlockquoteMarkers(pendingContent);
  if (hasAttachmentPlaceholder(normalized) && attachments.length === 0) return null;
  return hydrateCommentAttachmentMarkdown(normalized, attachments);
}

function getInitialEditorContent(initialValue: string, attachments: Attachment[]): string {
  const normalized = normalizeEscapedBlockquoteMarkers(initialValue);
  if (hasAttachmentPlaceholder(normalized) && attachments.length === 0) {
    return stripCommentAttachmentPlaceholders(normalized);
  }
  const hydrated = hydrateCommentAttachmentMarkdown(normalized, attachments);
  // [why] Legacy content may contain raw S3 presigned URLs from before the secure
  // proxy migration. Rewrite them to the authenticated proxy path before rendering.
  return rewriteS3UrlsToProxy(hydrated, attachments);
}

function looksLikeHtmlContent(value: string): boolean {
  return /<\/?[a-z][\w-]*(?:\s[^>]*)?>/i.test(value);
}

function buildEditorContentHtml(source: string, attachments: Attachment[]): string {
  const initialContent = getInitialEditorContent(source, attachments);
  if (!initialContent) return '';
  if (looksLikeHtmlContent(initialContent)) return normalizeRenderedLinkHtml(initialContent);
  return normalizeRenderedLinkHtml(marked.parse(initialContent) as string);
}

function setEditorContentFromSource(editor: Editor, source: string, attachments: Attachment[]): void {
  const htmlContent = buildEditorContentHtml(source, attachments);
  if (!htmlContent) {
    editor.commands.clearContent();
    return;
  }
  editor.commands.setContent(htmlContent);
  hydrateEditorLinkMarkClasses(editor);
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

    const rangeKey = `${range.from}:${range.to}`;
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
    const inferredMode = detectLinkDisplayMode(currentClass, text, title, hasHardBreak || text.includes('\n'));
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

  insertSnippetAt(
    editor,
    pos,
    buildAttachmentSnippet({ name: attachment.name, url, isImage }),
  );
  return true;
}

function getDraftStatusClass(status: DraftStatus): string {
  if (status === 'will_sync_when_online') return 'text-amber-500 dark:text-amber-400';
  if (status === 'synced') return 'text-success';
  return 'text-muted';
}

function buildDescriptionSaveMarkdown(
  editMode: 'rich' | 'markdown',
  editor: Editor | null,
  draft: string,
  attachments: Attachment[],
): string {
  if (editMode === 'rich' && editor) {
    return buildDescriptionMarkdown(editor, attachments);
  }

  return dehydrateCommentAttachmentMarkdown(escapeScriptTags(normalizeMarkdownLinkUrls(draft)), attachments);
}

function buildPreviewMarkdown(markdown: string, attachments: Attachment[]): string {
  const normalized = normalizeMarkdownLinkUrls(normalizeEscapedBlockquoteMarkers(markdown));
  if (attachments.length > 0) {
    const hydrated = hydrateCommentAttachmentMarkdown(normalized, attachments);
    return rewriteS3UrlsToProxy(hydrated, attachments);
  }

  return stripCommentAttachmentPlaceholders(normalized);
}

const CardDescriptionTiptap = ({ boardId, cardId, description, onSave, disabled }: Props) => {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(description);
  const [editMode, setEditMode] = useState<'rich' | 'markdown'>('rich');
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [cardAttachments, setCardAttachments] = useState<Attachment[]>([]);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [hoveredLink, setHoveredLink] = useState<ActiveEditorLink | null>(null);
  const [activeEditorLink, setActiveEditorLink] = useState<ActiveEditorLink | null>(null);
  const [linkConfigOpen, setLinkConfigOpen] = useState(false);
  const [linkEditOpen, setLinkEditOpen] = useState(false);
  const [linkEditUrl, setLinkEditUrl] = useState('');
  const [linkEditText, setLinkEditText] = useState('');

  // Auth + workspace context needed by the offline draft hook
  const currentUser = useSelector(selectCurrentUser);
  const token = useSelector(selectAccessToken) ?? undefined;
  const workspaceId = useSelector(selectActiveWorkspaceId) ?? undefined;

  // File picker input ref for attachment uploads
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLButtonElement>(null);
  const insertPosMap = useRef<Map<string, number>>(new Map());
  const editorRef = useRef<Editor | null>(null);
  const uploadFilesRef = useRef<((files: File[]) => string[]) | null>(null);
  const cardAttachmentsRef = useRef<Attachment[]>([]);
  const pendingHydratedContentRef = useRef<string | null>(description || null);
  const pendingAttachmentInsertRef = useRef<Map<string, number>>(new Map());
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const linkEditUrlInputRef = useRef<HTMLInputElement>(null);
  const linkConfigRef = useRef<HTMLDivElement>(null);
  const linkEditRef = useRef<HTMLDivElement>(null);

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

  const loadCardAttachments = useCallback(async () => {
    if (!cardId) {
      replaceCardAttachments([]);
      return;
    }
    try {
      const res = await listAttachments({ cardId });
      const sorted = [...res.data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      replaceCardAttachments(sorted);
    } catch {
      replaceCardAttachments([]);
    }
  }, [cardId, replaceCardAttachments]);

  useEffect(() => {
    void loadCardAttachments();
  }, [loadCardAttachments]);

  // Keep card attachments fresh when opening the picker.
  useEffect(() => {
    if (!assetPickerOpen) return;
    void loadCardAttachments();
  }, [assetPickerOpen, loadCardAttachments]);

  // Attachment upload — only active when a cardId is provided.
  const { uploads, upload: uploadFiles, removeEntry, flush: flushUploads } = useAttachmentUpload({
    cardId: cardId ?? '',
    deferred: true,
    onSuccess(attachment: Attachment, clientId: string) {
      prependCardAttachment(attachment);
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return;
      const savedPos = insertPosMap.current.get(clientId);
      insertPosMap.current.delete(clientId);
      const docSize = ed.state.doc.content.size;
      const insertAt = savedPos === undefined ? ed.state.selection.anchor : Math.min(savedPos, docSize);
      if (insertAttachmentAt(ed, attachment, insertAt)) return;
      // [why] Some fresh upload responses arrive before the card attachment URLs are
      // hydrated. Retry once the follow-up attachment list fetch returns URLs.
      pendingAttachmentInsertRef.current.set(attachment.id, insertAt);
    },
  });
  uploadFilesRef.current = uploadFiles;

  // Offline draft integration
  const {
    restoredDraft,
    draftStatus,
    isSavePending,
    onContentChange: notifyDraftChange,
    handleSaveIntent,
    clearDraft,
    retrySync,
    discardDraft,
  } = useOfflineDescriptionDraft({
    cardId,
    boardId,
    userId: currentUser?.id,
    workspaceId,
    token,
    currentDescription: description,
  });

  // Tiptap editor instance
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        // [why] linkOnPaste conflicts with the Markdown extension's paste handler —
        // both would insert the pasted URL, causing it to appear twice. autolink
        // already converts plain URLs to links after insertion.
        linkOnPaste: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Markdown,
      InlineImage,
      // [why] CardReference must come before buildMentionExtension so its parseHTML
      // priority (200) beats the Link extension's claim on card URLs.
      CardReference,
      buildMentionExtension(boardId),
    ],
    content: buildEditorContentHtml(description || '', cardAttachmentsRef.current),
    editable: editing && !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (!editor.isEditable) return;
      const markdown = buildDescriptionMarkdown(editor, cardAttachmentsRef.current);
      setDraft(markdown);
      notifyDraftChange(markdown);
    },
    editorProps: {
      // [why] Apply prose classes directly on ProseMirror so Tailwind Typography
      // descendant selectors (.prose ul, .prose blockquote, etc.) work correctly.
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none outline-none text-base',
      },
      handleDrop(view, event, _slice, moved) {
        if (moved || !event.dataTransfer) return false;
        const files = Array.from(event.dataTransfer.files);
        if (files.length === 0) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const pos = coords?.pos ?? view.state.doc.content.size;
        const ids = uploadFilesRef.current?.(files) ?? [];
        ids.forEach((id) => insertPosMap.current.set(id, pos));
        void flushUploads()
          .then(() => loadCardAttachments())
          .catch(() => {});
        return true;
      },
      // [why] Clipboard snapshots should be uploaded and inserted at cursor
      // position so paste behavior matches drag/drop and file picker insertion.
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length > 0) {
          event.preventDefault();
          const pos = view.state.selection.from;
          const ids = uploadFilesRef.current?.(files) ?? [];
          ids.forEach((id) => insertPosMap.current.set(id, pos));
          void flushUploads()
            .then(() => loadCardAttachments())
            .catch(() => {});
          return true;
        }

        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;
        const clipboardText = clipboardData.getData('text/plain').trim();

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

        const loadingToken = `link-loading-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const loadingClass = buildLinkClassName('url', [LINK_CLASS_LOADING, loadingToken]);

        editorRef.current
          ?.chain()
          .focus()
          .insertContentAt(pos, [
            {
              type: 'text',
              text: href,
              marks: [{ type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer', class: loadingClass } }],
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
    },
  });
  editorRef.current = editor;

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const hydratedContent = resolvePendingHydratedContent(
      pendingHydratedContentRef.current,
      cardAttachmentsRef.current,
    );
    if (!hydratedContent) return;
    setEditorContentFromSource(editor, hydratedContent, cardAttachmentsRef.current);
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

  useEffect(() => {
    if (editor) {
      editor.setEditable(editing && !disabled);
    }
  }, [editor, editing, disabled]);
  
  const handleEnterEdit = useCallback(() => {
    if (disabled) return;
    setEditing(true);
    if (editor) {
      // [why] Prefer the restored offline draft over the saved description so the
      // user never loses work that hasn't been synced yet.
      const startContent = restoredDraft ?? description ?? '';
      pendingHydratedContentRef.current = startContent;
      setEditorContentFromSource(editor, startContent, cardAttachmentsRef.current);
      editor.commands.focus('end');
      if (restoredDraft) setDraft(restoredDraft);
    }
    setEditMode('rich');
  }, [disabled, editor, description, restoredDraft]);

  const handleModeChange = useCallback(
    (mode: 'rich' | 'markdown') => {
      if (!editor) {
        setEditMode(mode);
        return;
      }

      if (mode === 'markdown' && editMode === 'rich') {
        setDraft(buildDescriptionMarkdown(editor, cardAttachmentsRef.current));
      }

      if (mode === 'rich' && editMode === 'markdown') {
        pendingHydratedContentRef.current = draft || '';
        setEditorContentFromSource(editor, draft || '', cardAttachmentsRef.current);
      }

      setEditMode(mode);
    },
    [editor, editMode, draft],
  );

  // Sync external description changes when not editing
  useEffect(() => {
    if (!editing && editor) {
      pendingHydratedContentRef.current = description || null;
      setEditorContentFromSource(editor, description || '', cardAttachmentsRef.current);
      setDraft(description);
    }
  }, [description, editing, editor]);

  useEffect(() => {
    if (!restoredDraft) return;
    pendingHydratedContentRef.current = restoredDraft;
  }, [restoredDraft]);

  const handleSave = useCallback(() => {
    const markdown = buildDescriptionSaveMarkdown(
      editMode,
      editor,
      draft,
      cardAttachmentsRef.current,
    );
    setDraft(markdown);

    // [why] If offline, queue the save for replay rather than calling onSave
    // which would silently fail or show a network error.
    const handledOffline = handleSaveIntent(markdown);
    if (handledOffline) {
      // Stay in editing mode so the user can see the "Will sync when online" status
      return;
    }

    onSave(markdown);
    // [why] Clear the draft immediately so the recovery banner doesn't reappear in the
    // same session. The restore effect only re-runs on cardId changes, not on description
    // prop changes, so without this the banner would show after every successful save.
    clearDraft();
    setAssetPickerOpen(false);
    setEditing(false);
  }, [draft, onSave, editor, editMode, handleSaveIntent, clearDraft]);

  const handleCancel = useCallback(() => {
    pendingHydratedContentRef.current = description || null;
    if (editor) {
      setEditorContentFromSource(editor, description || '', cardAttachmentsRef.current);
    }
    setDraft(description);
    discardDraft();
    setAssetPickerOpen(false);
    setEditing(false);
  }, [description, editor, discardDraft]);

  // Toggle the asset picker (existing card assets + upload action).
  const handleAttach = useCallback(() => {
    if (!cardId) return;
    if (editor && !editor.isDestroyed) {
      editor.commands.focus();
    }
    setLinkPopoverOpen(false);
    setLinkConfigOpen(false);
    setLinkEditOpen(false);
    setActiveEditorLink(null);
    setHoveredLink(null);
    setAssetPickerOpen((prev) => !prev);
  }, [cardId, editor]);

  // Insert an existing card attachment at the current cursor position.
  const handleInsertExisting = useCallback((attachment: Attachment) => {
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed) return;
    insertAttachmentAt(ed, attachment, ed.state.selection.anchor);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) {
        const pos = editor && !editor.isDestroyed
          ? editor.state.selection.anchor
          : 0;
        const ids = uploadFiles(files);
        ids.forEach((id) => insertPosMap.current.set(id, pos));
        void flushUploads()
          .then(() => loadCardAttachments())
          .catch(() => {});
      }
      setAssetPickerOpen(false);
      e.target.value = '';
    },
    [editor, uploadFiles, flushUploads, loadCardAttachments],
  );

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel],
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

  const handleLinkEditInputMouseDown = useCallback((event: React.MouseEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const input = event.currentTarget;
    globalThis.requestAnimationFrame(() => {
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
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
      // [why] URL mode should still allow a custom display label from the edit
      // popover. Fall back to raw URL only when no label is provided.
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

  const linkOverlayTarget = (linkConfigOpen ? activeEditorLink : hoveredLink) ?? null;
  const linkOverlayPosition = (() => {
    if (!linkOverlayTarget) return null;
    const container = editorScrollRef.current;
    if (!container) return null;
    const containerRect = container.getBoundingClientRect();
    // [why] Keep the trigger vertically aligned to the link line center.
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

    // [why] Keep toolbar outside the link box so it never obscures the text.
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
    if (!editing || editMode !== 'rich' || (!linkConfigOpen && !linkEditOpen)) return;
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
  }, [editing, editMode, linkConfigOpen, linkEditOpen, closeLinkConfigUi]);

  useEffect(() => {
    if (!editing || editMode !== 'rich') return;

    const refreshRects = () => {
      setHoveredLink((prev) => updateStoredLinkRect(prev));
      setActiveEditorLink((prev) => updateStoredLinkRect(prev));
    };

    window.addEventListener('resize', refreshRects);
    return () => {
      window.removeEventListener('resize', refreshRects);
    };
  }, [editing, editMode, updateStoredLinkRect]);

  useEffect(() => {
    if (!editing || editMode !== 'rich') {
      closeLinkConfigUi();
    }
  }, [editing, editMode, closeLinkConfigUi]);

  useEffect(() => {
    if (!editing || editMode !== 'rich' || !linkConfigOpen || !linkEditOpen) return;
    const input = linkEditUrlInputRef.current;
    if (!input) return;
    globalThis.requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }, [editing, editMode, linkConfigOpen, linkEditOpen, activeEditorLink?.from, activeEditorLink?.to]);

  const hydratedPreviewMarkdown = buildPreviewMarkdown(draft || '', cardAttachments);
  const isEmpty = !draft.trim();
  const isLong = draft.length > 400;
  const previewHtml = sanitizeUserGeneratedHtml(
    addLinkTargetBlank(normalizeRenderedLinkHtml(marked.parse(hydratedPreviewMarkdown) as string)),
  );
  const attachProps = cardId ? { onAttach: handleAttach } : undefined;

  useEffect(() => {
    if (editing || isEmpty) return;
    const root = previewContainerRef.current;
    if (!root) return;

    let cancelled = false;
    const objectUrls: string[] = [];

    const hydrateImage = async (img: HTMLImageElement): Promise<void> => {
      const rawSrc = img.getAttribute('src');
      if (!rawSrc) return;

      const placeholderName = readAttachmentPlaceholderName(rawSrc);
      const mappedAttachment = placeholderName
        ? cardAttachmentsRef.current.find((attachment) => attachment.name === placeholderName)
        : null;
      const mappedSrc = mappedAttachment
        ? resolveAttachmentMarkdownUrl(mappedAttachment, false)
        : null;
      const effectiveSrc = mappedSrc ?? rawSrc;
      if (effectiveSrc !== rawSrc) {
        img.src = effectiveSrc;
      }

      let url: URL;
      try {
        url = new URL(effectiveSrc, globalThis.location.origin);
      } catch {
        return;
      }

      if (!/^\/api\/v1\/attachments\/[^/]+\/(?:view|thumbnail)$/.test(url.pathname)) return;

      try {
        const requestInit: RequestInit = { credentials: 'include' };
        if (token) {
          requestInit.headers = { Authorization: `Bearer ${token}` };
        }
        const response = await fetch(`${url.pathname}${url.search}`, requestInit);
        if (!response.ok) return;
        const blob = await response.blob();
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.push(objectUrl);
        img.src = objectUrl;
      } catch {
        // Keep original src so browser fallback/error UI remains visible.
      }
    };

    const images = Array.from(root.querySelectorAll('img'));
    images.forEach((img) => {
      void hydrateImage(img);
    });

    hydratePreviewLinkModes(root);

    return () => {
      cancelled = true;
      objectUrls.forEach((value) => {
        URL.revokeObjectURL(value);
      });
    };
  }, [editing, isEmpty, previewHtml, token]);

  return (
    <section aria-label="Description">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
        Description
      </h3>
      {editing && !disabled ? (
        <div>
          {/* Hidden file input for attachment upload */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.zip,.tar,.gz,audio/*"
            className="hidden"
            onChange={handleFileInputChange}
            data-testid="description-attachment-input"
          />

          <div className="mb-2 flex items-center justify-between">
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                className={`px-2 py-1 text-xs ${editMode === 'rich' ? 'bg-indigo-600 text-inverse' : 'bg-bg-surface text-muted'}`}
                onClick={() => handleModeChange('rich')}
              >
                Rich text
              </button>
              <button
                type="button"
                className={`px-2 py-1 text-xs ${editMode === 'markdown' ? 'bg-indigo-600 text-inverse' : 'bg-bg-surface text-muted'}`}
                onClick={() => handleModeChange('markdown')}
              >
                Markdown
              </button>
            </div>
          </div>

          {editMode === 'rich' ? (
            <div className="flex max-h-[55vh] flex-col overflow-visible rounded-lg border border-border bg-bg-surface" data-upload-drop-exclude="true">
              {/* Single-line toolbar: primary controls always visible, secondary behind + */}
              <div className="relative">
                <OneLineToolbar
                  editor={editor}
                  overflowOpen={overflowOpen}
                  onToggleOverflow={() => setOverflowOpen((o) => !o)}
                  linkPopoverOpen={linkPopoverOpen}
                  onToggleLinkPopover={() => {
                    closeLinkConfigUi();
                    setAssetPickerOpen(false);
                    setLinkPopoverOpen((v) => !v);
                  }}
                  {...attachProps}
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
                className="relative min-h-[180px] flex-1 overflow-y-auto rounded-b-lg"
                onMouseDownCapture={(event) => {
                  const next = getEditorLinkFromTarget(event.target);
                  if (!next) return;
                  // [why] Prevent browser/link default navigation before click.
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
                  className="relative z-0 px-3 pb-3 pt-4 [&_.ProseMirror]:min-h-[160px] [&_.ProseMirror>*:first-child]:mt-0"
                />
                {editor && <CardReferenceBubbleMenu editor={editor} />}

                {linkOverlayPosition && linkOverlayTarget && !linkEditOpen && (
                  <button
                    type="button"
                    aria-label="Configure link"
                    title="Configure link"
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
                        aria-label="Display as button"
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
                        aria-label="Display as card"
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
                        globalThis.requestAnimationFrame(() => {
                          const input = linkEditUrlInputRef.current;
                          if (!input) return;
                          input.focus();
                          input.select();
                        });
                      }}
                    >
                      Edit link
                    </button>

                    <button
                      type="button"
                      title="Open Link In New Tab"
                      aria-label="Open Link In New Tab"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-bg-overlay hover:text-base"
                      onClick={() => {
                        window.open(normalizePreviewLinkHref(activeEditorLink.href), '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      title="Copy link"
                      aria-label="Copy link"
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
                      aria-label="Delete link"
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

                    {/* Keep spacing stable while toolbar is compact. */}
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
                        autoFocus
                        value={linkEditUrl}
                        onMouseDown={handleLinkEditInputMouseDown}
                        onClick={(event) => {
                          event.stopPropagation();
                          event.currentTarget.focus();
                        }}
                        onChange={(event) => {
                          setLinkEditUrl(event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return;
                          event.preventDefault();
                          applyLinkChange({
                            href: linkEditUrl,
                            displayMode: activeEditorLink.mode,
                            baseLabel: linkEditText,
                            openEdit: true,
                          });
                          setLinkEditOpen(false);
                        }}
                        placeholder="Paste or search for link"
                        className="w-full rounded-md border border-border bg-bg-overlay px-2.5 py-2 text-sm text-base outline-none focus:ring-2 focus:ring-primary"
                      />
                      <input
                        type="text"
                        value={linkEditText}
                        onMouseDown={handleLinkEditInputMouseDown}
                        onClick={(event) => {
                          event.stopPropagation();
                          event.currentTarget.focus();
                        }}
                        onChange={(event) => {
                          setLinkEditText(event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return;
                          event.preventDefault();
                          applyLinkChange({
                            href: linkEditUrl,
                            displayMode: activeEditorLink.mode,
                            baseLabel: linkEditText,
                            openEdit: true,
                          });
                          setLinkEditOpen(false);
                        }}
                        placeholder="Display text (optional)"
                        className="w-full rounded-md border border-border bg-bg-overlay px-2.5 py-2 text-sm text-base outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Inline upload previews — shown while files are in-flight */}
              {uploads.length > 0 && (
                <div
                  aria-label="File uploads"
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
          ) : (
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                notifyDraftChange(e.target.value);
              }}
              onKeyDown={handleEditorKeyDown}
              className="w-full min-h-[180px] rounded-lg border border-border bg-bg-overlay p-3 text-sm text-base font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Write markdown..."
            />
          )}

          <p className="mt-2 text-[11px] text-muted">
            Save as markdown. Shortcut: Ctrl/Cmd+Enter to save, Escape to cancel.
          </p>

          {/* Draft status footer */}
          {draftStatus !== 'idle' && (
            <div
              data-testid="draft-status-footer"
              className="mt-1 flex items-center gap-2 text-[11px]"
            >
              {draftStatus === 'sync_failed' ? (
                <>
                  <span className="text-danger">
                    {isSavePending ? 'Save failed' : 'Sync failed'}
                  </span>
                  <button
                    type="button"
                    className="text-indigo-400 hover:text-indigo-300 underline transition-colors"
                    onClick={() => retrySync(buildDescriptionSaveMarkdown(
                      editMode,
                      editor,
                      draft,
                      cardAttachmentsRef.current,
                    ))}
                    data-testid="draft-retry-sync"
                  >
                    {/* [why] "Retry Save" clarifies the user's pending action vs a background sync retry */}
                    {isSavePending ? 'Retry Save' : 'Retry'}
                  </button>
                  <button
                    type="button"
                    className="text-muted hover:text-subtle underline transition-colors"
                    onClick={discardDraft}
                    data-testid="draft-discard"
                  >
                    Discard draft
                  </button>
                </>
              ) : (
                <span className={getDraftStatusClass(draftStatus)}>
                  {isSavePending && draftStatus === 'will_sync_when_online'
                    ? 'Will save when back online'
                    : draftStatusLabel(draftStatus)}
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={handleSave}
            >
              Save
            </Button>
            <button
              type="button"
              className="px-3 py-1 text-muted hover:text-base text-xs transition-colors"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Draft recovery banner — shown in view mode when a local/synced draft differs from saved content */}
          {restoredDraft && !editing && !disabled && (
            <div
              data-testid="draft-recovery-banner"
              className="mb-2 flex items-center justify-between rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300"
            >
              <span>You have an unsaved draft</span>
              <button
                type="button"
                className="ml-4 text-indigo-500 hover:text-indigo-400 underline"
                onClick={handleEnterEdit}
              >
                Resume editing
              </button>
            </div>
          )}
          <button
            ref={previewContainerRef}
            type="button"
            aria-label={isEmpty ? 'Add a description (click to edit)' : 'Description (click to edit)'}
            onClick={disabled ? undefined : (e) => {
              const target = e.target as HTMLElement;
              const image = target.closest('img');
              if (image) {
                const src = image.getAttribute('src');
                if (src) {
                  e.preventDefault();
                  e.stopPropagation();
                  setPreviewImage({ src, alt: image.getAttribute('alt') ?? 'Description image' });
                }
                return;
              }

              // [why] Intercept link clicks so they open in a new tab and don't
              // trigger edit mode — same pattern as CardDescription.tsx.
              const link = target.closest('a');
              if (link) {
                const href = link.getAttribute('href');
                if (href && href !== '#') {
                  e.preventDefault();
                  window.open(normalizePreviewLinkHref(href), '_blank', 'noopener,noreferrer');
                }
                return;
              }
              handleEnterEdit();
            }}
            disabled={disabled}
            className={[
              'w-full text-left rounded-lg p-3 min-h-[80px] transition-colors',
              disabled
                ? 'cursor-default'
                : 'cursor-text hover:bg-bg-overlay',
              isEmpty
                ? 'text-muted text-sm italic bg-bg-overlay'
                : 'prose dark:prose-invert prose-sm max-w-none text-base',
              isLong && !expanded ? 'overflow-hidden' : '',
            ].join(' ')}
            style={isLong && !expanded ? { maxHeight: '12rem' } : undefined}
            {...(!isEmpty && { dangerouslySetInnerHTML: { __html: previewHtml } })}
          >
            {isEmpty ? 'Add a more detailed description…' : undefined}
          </button>
          {isLong && (
            <button
              type="button"
              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? 'Show less ↑' : 'Show more ↓'}
            </button>
          )}
        </div>
      )}
      {previewImage && (
        <ImageLightbox
          src={previewImage.src}
          name={previewImage.alt}
          onClose={() => { setPreviewImage(null); }}
        />
      )}
    </section>
  );
};

export default CardDescriptionTiptap;
