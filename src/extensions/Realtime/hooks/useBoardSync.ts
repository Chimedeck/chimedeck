// useBoardSync — subscribes to incoming WS events for a board and dispatches
// Redux actions to reconcile remote changes.
//
// WHY: kept separate from useWebSocket so the dispatch logic can be tested
// in isolation without needing a live WebSocket.
import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import type { RealtimeEvent } from '../client/socket';
import { listSliceActions } from '../../List/listSlice';
import { cardSliceActions } from '../../Card/cardSlice';
import { boardSliceActions, selectCards } from '../../Board/slices/boardSlice';
import { cardDetailSliceActions } from '../../Card/slices/cardDetailSlice';
import type { List } from '../../List/api';
import type { Card } from '../../Card/api';
import type { CommentData } from '../../Card/api/cardDetail';
import { selectCurrentUser } from '~/slices/authSlice';
import type { ActivityData } from '../../Card/slices/cardDetailSlice';

export interface UseBoardSyncOptions {
  boardId: string;
}

export interface UseBoardSyncResult {
  /** Pass this to useWebSocket's onEvent */
  handleEvent: (event: RealtimeEvent) => void;
  /** Last seen server sequence number (for re-sync after reconnect) */
  lastSequence: number;
}

export function useBoardSync({ boardId }: UseBoardSyncOptions): UseBoardSyncResult {
  const dispatch = useAppDispatch();
  const cards = useAppSelector(selectCards);
  const currentUser = useAppSelector(selectCurrentUser);
  // Deduplication set: "entityId:sequence" → prevent double-apply
  const seen = useRef<Set<string>>(new Set());
  const lastSeqRef = useRef(0);
  const cardsRef = useRef(cards);
  const currentUserIdRef = useRef<string | null>(currentUser?.id ?? null);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    currentUserIdRef.current = currentUser?.id ?? null;
  }, [currentUser?.id]);

  const applyRemoteCommentAdded = useCallback(
    ({
      comment,
      cardId,
      actorId,
    }: {
      comment: CommentData | undefined;
      cardId: string | undefined;
      actorId: string | undefined;
    }) => {
      if (comment) {
        dispatch(cardDetailSliceActions.addComment(comment));
      }

      // Keep board card badge counts in sync for realtime updates.
      const targetCardId = comment?.card_id ?? cardId;
      const currentUserId = currentUserIdRef.current;
      const isOwnComment =
        (comment?.user_id != null && comment.user_id === currentUserId) ||
        (actorId != null && actorId === currentUserId);

      if (!isOwnComment && targetCardId) {
        const boardCard = cardsRef.current[targetCardId];
        if (boardCard) {
          dispatch(
            boardSliceActions.updateCard({
              card: {
                ...boardCard,
                comment_count: (boardCard.comment_count ?? 0) + 1,
              },
            }),
          );
        }
      }
    },
    [dispatch],
  );

  const handleEvent = useCallback(
    (event: RealtimeEvent) => {
      const { type, sequence, payload } = event;
      if (!payload) return;

      // Deduplication: skip events we've already applied
      if (sequence !== undefined) {
        const dedupeKey = `${type}:${String(sequence)}`;
        if (seen.current.has(dedupeKey)) return;
        seen.current.add(dedupeKey);
        // Keep set bounded to avoid unbounded growth
        if (seen.current.size > 2_000) seen.current.clear();
        lastSeqRef.current = Math.max(lastSeqRef.current, sequence);
      }

      switch (type) {
        // ── List events ──────────────────────────────────────────────────
        case 'list_created': {
          const list = (payload as { list: List }).list;
          dispatch(listSliceActions.remoteCreate(payload as Parameters<typeof listSliceActions.remoteCreate>[0]));
          dispatch(boardSliceActions.addList({ list }));
          break;
        }
        case 'list_updated': {
          const list = (payload as { list: List }).list;
          dispatch(listSliceActions.remoteUpdate(payload as Parameters<typeof listSliceActions.remoteUpdate>[0]));
          dispatch(boardSliceActions.updateList({ list }));
          break;
        }
        case 'list_archived':
          dispatch(listSliceActions.remoteArchive(payload as Parameters<typeof listSliceActions.remoteArchive>[0]));
          break;
        case 'list_reordered': {
          const p = payload as { boardId: string; lists: List[] };
          dispatch(listSliceActions.remoteReorder(payload as Parameters<typeof listSliceActions.remoteReorder>[0]));
          // Derive new order from authoritative positions list
          const newOrder = [...p.lists]
            .sort((a, b) => (a.position < b.position ? -1 : 1))
            .map((l) => l.id);
          dispatch(boardSliceActions.applyOptimisticListReorder({ newOrder }));
          break;
        }

        // ── Card events ──────────────────────────────────────────────────
        case 'card_created': {
          const card = (payload as { card: Card }).card;
          dispatch(cardSliceActions.remoteCreate(payload as Parameters<typeof cardSliceActions.remoteCreate>[0]));
          dispatch(boardSliceActions.addCard({ card }));
          break;
        }
        case 'card_updated': {
          const card = (payload as { card: Card }).card;
          dispatch(cardSliceActions.remoteUpdate(payload as Parameters<typeof cardSliceActions.remoteUpdate>[0]));
          dispatch(boardSliceActions.updateCard({ card }));
          // Also update the card detail modal if it's open for this card
          dispatch(cardDetailSliceActions.remoteUpdate({ card }));
          break;
        }
        case 'card_moved': {
          const { card, fromListId } = payload as { card: Card; fromListId: string };
          dispatch(cardSliceActions.remoteMove({ card, fromListId }));
          dispatch(boardSliceActions.remoteCardMove({ card, fromListId }));
          break;
        }
        case 'card_archived': {
          const { cardId, listId } = payload as { cardId: string; listId: string };
          dispatch(cardSliceActions.remoteArchive({ cardId }));
          dispatch(boardSliceActions.removeCard({ cardId, listId }));
          break;
        }

        // ── Comment events ────────────────────────────────────────────────
        case 'comment_added': {
          const { comment, cardId } = payload as { comment?: CommentData; cardId?: string };
          applyRemoteCommentAdded({
            comment,
            cardId,
            actorId: (event as { actor_id?: string }).actor_id,
          });
          break;
        }
        case 'comment_updated': {
          const { comment } = payload as { comment: CommentData };
          dispatch(cardDetailSliceActions.updateComment(comment));
          break;
        }
        case 'comment_deleted': {
          const { commentId } = payload as { commentId: string };
          dispatch(cardDetailSliceActions.removeComment({ commentId }));
          break;
        }

        // ── Comment reaction events ───────────────────────────────────────
        case 'comment_reaction_added': {
          // [why] Server emits snake_case keys (comment_id, user_id) — destructure accordingly.
          const { comment_id: commentId, emoji, user_id: userId, actor_name: actorName } =
            payload as { comment_id: string; emoji: string; user_id: string; actor_name?: string | null };
          const reactedByMe = userId === currentUserIdRef.current;
          dispatch(cardDetailSliceActions.addReaction({ commentId, emoji, userId, reactedByMe, actorName: actorName ?? null }));
          break;
        }
        case 'comment_reaction_removed': {
          const { comment_id: commentId, emoji, user_id: userId } =
            payload as { comment_id: string; emoji: string; user_id: string };
          const reactedByMe = userId === currentUserIdRef.current;
          dispatch(cardDetailSliceActions.removeReaction({ commentId, emoji, userId, reactedByMe }));
          break;
        }

        // ── Comment reply events ──────────────────────────────────────────
        case 'comment_reply_added': {
          const { parent_comment_id, reply } = payload as { parent_comment_id: string; reply: CommentData };
          // [why] The author path already updates reply_count after POST success.
          // Ignore our own WS echo to avoid counting the same reply twice.
          if (reply?.user_id && reply.user_id === currentUserIdRef.current) break;
          dispatch(cardDetailSliceActions.addReply({ parentId: parent_comment_id, reply }));
          break;
        }

        // ── Card activity events ──────────────────────────────────────────
        case 'card_activity_created': {
          // [why] Reducer filters by openCardId so cross-card events are silently ignored.
          const { activity } = payload as { activity: ActivityData };
          dispatch(cardDetailSliceActions.addActivity(activity));
          break;
        }

        // ── Presence events ───────────────────────────────────────────────
        case 'presence_update':
          // Presence is handled by the PresenceAvatars component via its own
          // local state; nothing to dispatch to the entity slices.
          break;

        // ── Board events ──────────────────────────────────────────────────
        case 'board.background_changed': {
          const { background } = payload as { background: string | null };
          dispatch(boardSliceActions.updateBoardBackground({ background }));
          break;
        }

        default:
          // Unknown event type — ignore
          break;
      }

      // Notify wsMiddleware that this sequence is confirmed via WS
      // (prevents double-confirmation when HTTP response arrives later)
      if (sequence !== undefined) {
        dispatch({ type: 'realtime/wsConfirmed', payload: { type, sequence, boardId } });
      }
    },
    [applyRemoteCommentAdded, dispatch, boardId],
  );

  return { handleEvent, lastSequence: lastSeqRef.current };
}
