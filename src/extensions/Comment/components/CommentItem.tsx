// Single comment with inline edit/delete controls
import { useCallback, useEffect, useRef, useState } from 'react';
import { Marked } from 'marked';
import emojiData from '@emoji-mart/data';
import type { Attachment } from '~/extensions/Attachments/types';
import {
  hydrateCommentAttachmentMarkdown,
  readAttachmentPlaceholderName,
  resolveAttachmentMarkdownUrl,
  stripCommentAttachmentPlaceholders,
} from '~/extensions/Comment/utils/attachmentMarkdown';
import Button from '~/common/components/Button';
import CommentEditor from './CommentEditor';
import CommentDeletedItem from './CommentDeletedItem';
import CommentReactions from './CommentReactions';
import CommentReplyThread from './CommentReplyThread';
import { ImageLightbox } from '~/extensions/Attachments/components/AttachmentThumbnail';
import { enrichExternalLinkChips } from '~/extensions/Attachments/utils/enrichExternalLinkChips';
import translations from '../translations/en.json';
import apiClient from '~/common/api/client';

/**
 * Add target="_blank" rel="noopener noreferrer" to external links that don't already
 * have a target attribute and whose href is not a bare anchor (#...).
 */
function addLinkTargetBlank(html: string): string {
  return html.replace(
    /<a(?=[^>]*\bhref="(?!#))(?![^>]*\btarget=)/gi,
    '<a target="_blank" rel="noopener noreferrer"',
  );
}

// Use a local parser instance so global marked extensions configured elsewhere
// cannot break comment rendering in this component.
const commentMarked = new Marked({ breaks: true, gfm: true });

// Build once so shortcode replacement is O(1) per token during render.
const SHORTCODE_TO_NATIVE = (() => {
  const map = new Map<string, string>();
  const emojis = emojiData.emojis as Record<string, { skins?: Array<{ native?: string }> }>;
  const aliases = (emojiData.aliases ?? {}) as Record<string, string>;

  for (const [shortcode, value] of Object.entries(emojis)) {
    const native = value.skins?.[0]?.native;
    if (!native) continue;
    map.set(shortcode.toLowerCase(), native);
  }

  for (const [alias, canonical] of Object.entries(aliases)) {
    const native = emojis[canonical]?.skins?.[0]?.native;
    if (!native) continue;
    map.set(alias.toLowerCase(), native);
  }

  return map;
})();

function replaceEmojiShortcodes(text: string): string {
  return text.replaceAll(/:([a-z0-9_+-]+):/gi, (full, shortcode: string) => {
    return SHORTCODE_TO_NATIVE.get(shortcode.toLowerCase()) ?? full;
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  /** Names of users who reacted — populated from initial fetch; may lag on WS-only updates */
  reactors?: Array<{ userId: string; name: string | null }>;
}

export interface Comment {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  version: number;
  deleted: boolean;
  created_at: string;
  updated_at: string;
  // Author info returned from server (joined with users table)
  author_name?: string | null;
  author_email?: string | null;
  author_avatar_url?: string | null;
  reactions?: ReactionSummary[];
  parent_id?: string | null;
  reply_count?: number;
}

interface Props {
  comment: Comment;
  boardId?: string;
  attachments?: Attachment[];
  currentUserId: string;
  isAdmin?: boolean;
  /** True when this comment is the deep-link target from notification navigation. */
  isNotificationTarget?: boolean;
  /** Auto-expand replies when a reply notification points at this parent comment. */
  autoExpandReplies?: boolean;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onAddReaction?: (commentId: string, emoji: string) => Promise<void>;
  onRemoveReaction?: (commentId: string, emoji: string) => Promise<void>;
  onReply?: (commentId: string) => void;
  onAddReply?: (parentId: string, content: string) => Promise<void>;
  onEditReply?: (commentId: string, content: string) => Promise<void>;
  onDeleteReply?: (commentId: string) => Promise<void>;
  cardId?: string;
}

/** Generate initials from a display name or email. */
function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  const source = name || email || '?';
  const parts = source.split(/[\s@.]/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

/** Consistent avatar colour based on user id. */
// Darker shades guarantee sufficient contrast against text-inverse (white in light mode)
const AVATAR_COLORS = [
  'bg-blue-600', 'bg-green-700', 'bg-purple-600',
  'bg-pink-600', 'bg-amber-700', 'bg-orange-700', 'bg-teal-700',
];
function avatarColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = Math.trunc(hash * 31 + (userId.codePointAt(i) ?? 0));
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function buildBoardProps(boardId?: string): { boardId: string } | Record<string, never> {
  return boardId ? { boardId } : {};
}

/** Render a relative time string. */
function relativeTime(iso: string): string {
  const date = new Date(iso);
  const diff = (Date.now() - date.getTime()) / 1000;
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diff < 60) return translations['comment.relativeTime.justNow'];
  if (diff < 3600) return `${Math.floor(diff / 60)} ${translations['comment.relativeTime.minAgo']} · ${time}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ${translations['comment.relativeTime.hrAgo']} · ${time}`;
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${day}, ${time}`;
}

/** Parse markdown and highlight @mention chips inside comment text. Returns safe HTML string. */
function renderContent(text: string, attachments: Attachment[]): string {
  const hydrated = attachments.length > 0
    ? hydrateCommentAttachmentMarkdown(text, attachments)
    : stripCommentAttachmentPlaceholders(text);
  const withNativeEmoji = replaceEmojiShortcodes(hydrated);
  // [why] Legacy/server-sanitized comments may store blockquote markers as
  // "&gt;". Convert marker positions back to markdown so rendering matches editor.
  const normalized = withNativeEmoji.replaceAll(/^(\s*)&gt;(?=\s|$)/gm, '$1>');
  let html: string;
  try {
    // Convert markdown -> HTML.
    html = commentMarked.parse(normalized) as string;
  } catch {
    // [why] Prevent intermittent parser extension mismatches from crashing card load.
    html = escapeHtml(normalized).replaceAll('\n', '<br>');
  }
  // Wrap @mentions in a styled chip
  const withMentions = html.replaceAll(
    /(@\w[\w.+-]*)/g,
    '<span class="rounded bg-blue-100 px-1 py-0.5 text-xs font-medium text-blue-700">$1</span>',
  );
  // [why] Ensure all links open in a new tab so the user is never navigated away
  // from the board view.
  return addLinkTargetBlank(withMentions);
}

const CommentItem = ({ comment, boardId, attachments = [], currentUserId, isAdmin = false, isNotificationTarget = false, autoExpandReplies = false, onEdit, onDelete, onAddReaction, onRemoveReaction, onReply, onAddReply, onEditReply, onDeleteReply, cardId }: Props) => {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [replyExpanded, setReplyExpanded] = useState(autoExpandReplies);
  const [showReplyEditor, setShowReplyEditor] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const commentMarkdownRef = useRef<HTMLDivElement>(null);
  // [why] Keep first locally-created reply thread mounted before parent `reply_count` refreshes.
  const [hasLocalReplies, setHasLocalReplies] = useState((comment.reply_count ?? 0) > 0);

  useEffect(() => {
    if ((comment.reply_count ?? 0) > 0) {
      setHasLocalReplies(true);
    }
  }, [comment.reply_count]);

  useEffect(() => {
    if (!isNotificationTarget) return;
    if (autoExpandReplies) {
      setReplyExpanded(true);
    }
    rootRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [isNotificationTarget, autoExpandReplies]);

  const handleAddReply = useCallback(async (parentId: string, content: string) => {
    if (!onAddReply) return;
    await onAddReply(parentId, content);
    setHasLocalReplies(true);
    setReplyExpanded(true);
  }, [onAddReply]);

  useEffect(() => {
    if (editing) return;
    const root = commentMarkdownRef.current;
    if (!root) return;

    let cancelled = false;
    const objectUrls: string[] = [];

    const hydrateImage = async (img: HTMLImageElement): Promise<void> => {
      const rawSrc = img.getAttribute('src');
      if (!rawSrc) return;

      const placeholderName = readAttachmentPlaceholderName(rawSrc);
      const mappedAttachment = placeholderName
        ? attachments.find((attachment) => attachment.name === placeholderName)
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
        const blob = await apiClient.get<Blob>(`${url.pathname}${url.search}`, { responseType: 'blob' });
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

    void enrichExternalLinkChips(root);

    return () => {
      cancelled = true;
      objectUrls.forEach((value) => URL.revokeObjectURL(value));
    };
  }, [comment.content, attachments, editing]);

  if (comment.deleted) {
    return <CommentDeletedItem commentId={comment.id} createdAt={comment.created_at} />;
  }

  const isOwner = comment.user_id === currentUserId;
  const canEdit = isOwner;
  const canDelete = isOwner || isAdmin;

  const displayName = comment.author_name || comment.author_email || translations['comment.author.unknown'];
  const initials = getInitials(comment.author_name, comment.author_email);
  const color = avatarColor(comment.user_id);
  const avatarUrl = comment.author_avatar_url ?? null;

  const handleEdit = async (content: string) => {
    await onEdit(comment.id, content);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(translations['comment.confirm.delete'])) return;
    setDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div ref={rootRef} className="flex gap-3">
      {/* Avatar */}
      <div
        className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ${avatarUrl ? '' : color} overflow-hidden`} // [theme-exception] text-white on colored avatar
        title={displayName}
      >
        {avatarUrl
          ? <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover rounded-full" />
          : initials
        }
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Header: name + timestamp */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold text-base">{displayName}</span>
          <span className="text-xs text-muted">{relativeTime(comment.created_at)}</span>
          {comment.version > 1 && (
            <span className="text-xs italic text-muted">{translations['comment.edited']}</span>
          )}
        </div>

        {/* Comment text or editor */}
        {editing ? (
          <CommentEditor
            {...buildBoardProps(boardId)}
            cardId={comment.card_id}
            availableAttachments={attachments}
            initialValue={comment.content}
            onSubmit={handleEdit}
            onCancel={() => setEditing(false)}
            submitLabel={translations['comment.editor.update']}
          />
        ) : (
          <div className="border border-border rounded-md px-3 py-2 bg-surface">
            <div
              ref={commentMarkdownRef}
              className="comment-markdown prose prose-sm dark:prose-invert max-w-none text-base break-words
                [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              onClick={(event) => {
                const target = event.target as HTMLElement;
                const image = target.closest('img');
                if (!image) return;
                const src = image.getAttribute('src');
                if (!src) return;
                event.preventDefault();
                event.stopPropagation();
                setPreviewImage({ src, alt: image.getAttribute('alt') ?? 'Comment image' });
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                const target = event.target as HTMLElement;
                const image = target.querySelector('img');
                if (!image) return;
                const src = image.getAttribute('src');
                if (!src) return;
                event.preventDefault();
                event.stopPropagation();
                setPreviewImage({ src, alt: image.getAttribute('alt') ?? 'Comment image' });
              }}
              // [why] dangerouslySetInnerHTML — content is user-authored markdown parsed by marked.
              // Input is from authenticated users only (internal tool), so XSS risk is accepted.
              dangerouslySetInnerHTML={{ __html: renderContent(comment.content, attachments) }}
            />
          </div>
        )}

        {/* Reactions + inline action links on one row */}
        {!editing && (
          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
            {(onAddReaction || onRemoveReaction) && (
              <CommentReactions
                className="mt-0"
                reactions={comment.reactions ?? []}
                onAdd={(emoji) => onAddReaction?.(comment.id, emoji) ?? Promise.resolve()}
                onRemove={(emoji) => onRemoveReaction?.(comment.id, emoji) ?? Promise.resolve()}
              />
            )}

            {(onAddReaction || onRemoveReaction) && (canEdit || canDelete || (onAddReply && !comment.parent_id)) && <span>·</span>}

            {canEdit && (
              <Button
                variant="link"
                className="p-0 text-xs text-muted hover:text-subtle"
                onClick={() => setEditing(true)}
              >
                {translations['comment.action.edit']}
              </Button>
            )}
            {canEdit && canDelete && <span>·</span>}
            {canDelete && (
              <Button
                variant="link"
                className="p-0 text-xs text-muted hover:text-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? translations['comment.action.deleting'] : translations['comment.action.delete']}
              </Button>
            )}
            {/* Reply button — only on top-level comments (no parent_id) */}
            {onAddReply && !comment.parent_id && (
              <>
                {(canEdit || canDelete) && <span>·</span>}
                <Button
                  variant="link"
                  className="p-0 text-xs text-muted hover:text-subtle"
                  onClick={() => setShowReplyEditor((prev) => !prev)}
                >
                  {translations['comment.action.reply']}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Reply thread — only on top-level comments */}
        {!comment.parent_id && ((comment.reply_count ?? 0) > 0 || hasLocalReplies || showReplyEditor) && onAddReply && cardId && (
          <CommentReplyThread
            parentComment={comment}
            cardId={cardId}
            {...(boardId !== undefined ? { boardId } : {})}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            expanded={replyExpanded}
            showReplyEditor={showReplyEditor}
            onExpandToggle={setReplyExpanded}
            onHideReplyEditor={() => setShowReplyEditor(false)}
            onAddReply={handleAddReply}
            onEditReply={onEditReply ?? (() => Promise.resolve())}
            onDeleteReply={onDeleteReply ?? (() => Promise.resolve())}
            {...(onAddReaction ? { onAddReaction } : {})}
            {...(onRemoveReaction ? { onRemoveReaction } : {})}
          />
        )}
      </div>
      {previewImage && (
        <ImageLightbox
          src={previewImage.src}
          name={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
};

export default CommentItem;

