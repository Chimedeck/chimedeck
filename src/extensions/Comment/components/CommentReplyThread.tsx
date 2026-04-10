// CommentReplyThread — load-on-demand threaded replies for a single parent comment.
// Replies are fetched when the user expands the thread; reply editor opens inline.
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '~/common/api/client';
import { getReplies } from '../api';
import type { Comment } from './CommentItem';
import CommentItem from './CommentItem';
import CommentEditor from './CommentEditor';
import translations from '../translations/en.json';

interface Props {
  parentComment: Comment;
  cardId: string;
  boardId?: string;
  currentUserId: string;
  isAdmin?: boolean;
  expanded: boolean;
  showReplyEditor: boolean;
  onExpandToggle: (expanded: boolean) => void;
  onHideReplyEditor: () => void;
  onAddReply: (parentId: string, content: string) => Promise<void>;
  onEditReply: (commentId: string, content: string) => Promise<void>;
  onDeleteReply: (commentId: string) => Promise<void>;
  onAddReaction?: (commentId: string, emoji: string) => Promise<void>;
  onRemoveReaction?: (commentId: string, emoji: string) => Promise<void>;
}

const CommentReplyThread = ({
  parentComment,
  cardId,
  boardId,
  currentUserId,
  isAdmin = false,
  expanded,
  showReplyEditor,
  onExpandToggle,
  onHideReplyEditor,
  onAddReply,
  onEditReply,
  onDeleteReply,
  onAddReaction,
  onRemoveReaction,
}: Props) => {
  const [replies, setReplies] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  // [why] Track local reply_count so we can increment optimistically on new reply.
  const [localReplyCount, setLocalReplyCount] = useState(parentComment.reply_count ?? 0);

  // Sync localReplyCount when parent prop changes (e.g. from Redux state update)
  useEffect(() => {
    setLocalReplyCount(parentComment.reply_count ?? 0);
  }, [parentComment.reply_count]);

  const loadReplies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReplies({ api: apiClient as Parameters<typeof getReplies>[0]['api'], commentId: parentComment.id });
      setReplies(data as Comment[]);
    } catch {
      // non-critical; user can try expanding again
    } finally {
      setLoading(false);
    }
  }, [parentComment.id]);

  // Fetch replies when expanding for the first time
  useEffect(() => {
    if (expanded && replies.length === 0 && !loading) {
      void loadReplies();
    }
  }, [expanded, replies.length, loading, loadReplies]);

  // Also fetch when the reply editor is shown and there are existing replies to display
  useEffect(() => {
    if (showReplyEditor && localReplyCount > 0 && replies.length === 0 && !loading) {
      void loadReplies();
    }
  }, [showReplyEditor, localReplyCount, replies.length, loading, loadReplies]);

  const handleSubmitReply = async (content: string) => {
    await onAddReply(parentComment.id, content);
    onHideReplyEditor();
    // Optimistically increment count and refresh thread
    setLocalReplyCount((prev) => prev + 1);
    void loadReplies();
  };

  const replyCount = localReplyCount;
  const showThread = expanded || (showReplyEditor && replyCount > 0);

  return (
    <div className="mt-2">
      {/* Expand / collapse toggle */}
      {replyCount > 0 && (
        <button
          onClick={() => onExpandToggle(!expanded)}
          className="mt-1 text-xs font-semibold text-primary hover:underline"
        >
          {expanded
            ? translations['comment.replies.hide']
            : replyCount === 1
              ? translations['comment.replies.viewOne']
              : translations['comment.replies.viewMany'].replace('{{count}}', String(replyCount))}
        </button>
      )}

      {/* Thread container */}
      {(showThread || showReplyEditor) && (
        <div className="border-l-2 border-border ml-9 pl-3 mt-2 flex flex-col gap-3">
          {loading && <p className="text-xs text-muted animate-pulse">Loading replies…</p>}

          {!loading && replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              {...(boardId !== undefined ? { boardId } : {})}
              cardId={cardId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onEdit={onEditReply}
              onDelete={onDeleteReply}
              // [why] No onAddReply passed — prevents infinite nesting (max depth = 1)
              {...(onAddReaction ? { onAddReaction } : {})}
              {...(onRemoveReaction ? { onRemoveReaction } : {})}
            />
          ))}

          {/* Inline reply composer */}
          {showReplyEditor && (
            <CommentEditor
              {...(boardId !== undefined ? { boardId } : {})}
              cardId={cardId}
              placeholder={translations['comment.reply.placeholder']}
              onSubmit={handleSubmitReply}
              onCancel={onHideReplyEditor}
              submitLabel={translations['comment.reply.submit']}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default CommentReplyThread;

