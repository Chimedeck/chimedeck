// Hook that wires offline draft persistence and sync for the comment editor.
//
// WHY: mirrors useOfflineDescriptionDraft but for comment drafts. Isolated here
// so CommentEditor stays focused on rendering/UX. Key differences:
//   - draftType is 'comment'
//   - handleSubmitIntent queues a POST (not PATCH) with an idempotency key
//   - intent becomes 'submit_pending' (not 'save_pending') when offline submit occurs
//   - boardId may be undefined (new comment editors don't always have it)
import { useState, useEffect, useCallback, useRef } from 'react';
import { getDraft, saveDraft, deleteDraft } from '../storage';
import { listServerDrafts, upsertServerDraft } from '../api';
import { reconcileDraftForType } from '../reconcile';
import { messageQueue } from '~/extensions/Realtime/client/messageQueue';
import { socket } from '~/extensions/Realtime/client/socket';
import type { DraftStatus } from './useOfflineDescriptionDraft';

export type { DraftStatus };

export interface UseOfflineCommentDraftOptions {
  cardId: string | undefined;
  boardId: string | undefined;
  userId: string | undefined;
  workspaceId: string | undefined;
  token: string | undefined;
}

export interface UseOfflineCommentDraftResult {
  /** Draft content to pre-fill the editor on card open, null means start empty. */
  restoredDraft: string | null;
  draftStatus: DraftStatus;
  /**
   * Call this on every editor keystroke (after your own state update).
   * Internally debounced — safe to call on every keystroke.
   */
  onContentChange: (markdown: string) => void;
  /**
   * Call when the user presses the Submit / Comment button.
   * Returns true if offline (caller must NOT call onSubmit — queue will replay).
   * Returns false when online (caller should call onSubmit then clearDraft).
   */
  handleSubmitIntent: (markdown: string) => boolean;
  /** Clear both local and server drafts (call after successful online submit). */
  clearDraft: () => void;
  /** Retry a failed server draft sync (bound to "Retry" footer button). */
  retrySync: (markdown: string) => void;
  /** Discard the draft entirely (bound to "Discard" footer button). */
  discardDraft: () => void;
}

const LOCAL_SAVE_DEBOUNCE_MS = 800;
const SERVER_SYNC_DEBOUNCE_MS = 3_000;

export function useOfflineCommentDraft({
  cardId,
  boardId,
  userId,
  workspaceId,
  token,
}: UseOfflineCommentDraftOptions): UseOfflineCommentDraftResult {
  const [restoredDraft, setRestoredDraft] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('idle');

  // Latest content ref — always current without recreating debounced callbacks
  const latestContentRef = useRef<string>('');
  const localSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // [why] Stable idempotency key for the current submit_pending attempt.
  // Generated once per offline-submit; reused on retry so the server deduplicates.
  const idempotencyKeyRef = useRef<string | null>(null);

  const isReady = Boolean(cardId && userId && workspaceId);

  // ---------- Helpers ----------

  const saveLocal = useCallback(
    async (markdown: string) => {
      if (!cardId || !userId || !workspaceId) return;
      await saveDraft({
        userId,
        workspaceId,
        cardId,
        draftType: 'comment',
        contentMarkdown: markdown,
        intent: 'editing',
        updatedAt: new Date().toISOString(),
      });
      setDraftStatus('saved_local');
    },
    [cardId, userId, workspaceId],
  );

  const syncToServer = useCallback(
    async (markdown: string) => {
      if (!cardId || !token) return;
      setDraftStatus('syncing');
      try {
        await upsertServerDraft({
          cardId,
          draftType: 'comment',
          payload: {
            content_markdown: markdown,
            intent: 'editing',
            client_updated_at: new Date().toISOString(),
          },
          token,
        });
        setDraftStatus('synced');
      } catch {
        setDraftStatus('sync_failed');
      }
    },
    [cardId, token],
  );

  // ---------- Restore draft on card open ----------

  useEffect(() => {
    if (!isReady || !cardId || !userId || !workspaceId) {
      setRestoredDraft(null);
      setDraftStatus('idle');
      idempotencyKeyRef.current = null;
      return;
    }

    let cancelled = false;

    const restore = async () => {
      const local = await getDraft({ userId, workspaceId, cardId, draftType: 'comment' });

      if (cancelled) return;

      if (socket.isConnected && token) {
        try {
          const serverDrafts = await listServerDrafts({ cardId, token });
          if (cancelled) return;
          const result = reconcileDraftForType({ local, serverDrafts, draftType: 'comment' });

          if (result.source !== 'none' && result.contentMarkdown) {
            setRestoredDraft(result.contentMarkdown);
            if (result.source === 'server' && result.contentMarkdown) {
              void saveDraft({
                userId,
                workspaceId,
                cardId,
                draftType: 'comment',
                contentMarkdown: result.contentMarkdown,
                intent: result.intent ?? 'editing',
                updatedAt: result.updatedAt ?? new Date().toISOString(),
              });
            }
            const isSubmitPending = result.intent === 'submit_pending';
            setDraftStatus(
              isSubmitPending ? 'will_sync_when_online'
                : result.source === 'server' ? 'synced'
                : 'saved_local',
            );
          } else {
            setRestoredDraft(null);
            setDraftStatus('idle');
          }
          return;
        } catch {
          // Server fetch failed — fall through to local-only restore
        }
      }

      // Local-only restore (offline or server unreachable)
      if (local && local.contentMarkdown) {
        setRestoredDraft(local.contentMarkdown);
        setDraftStatus(
          local.intent === 'submit_pending' ? 'will_sync_when_online' : 'saved_local',
        );
      } else {
        setRestoredDraft(null);
        setDraftStatus('idle');
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
    // [why] Only re-run when the card changes — not on every token change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, userId, workspaceId, token]);

  // ---------- Debounced local + server persistence on content change ----------

  const onContentChange = useCallback(
    (markdown: string) => {
      if (!isReady) return;
      latestContentRef.current = markdown;
      setDraftStatus('saving_local');

      if (localSaveTimer.current) clearTimeout(localSaveTimer.current);
      localSaveTimer.current = setTimeout(() => {
        void saveLocal(latestContentRef.current);
      }, LOCAL_SAVE_DEBOUNCE_MS);

      if (socket.isConnected && token) {
        if (serverSyncTimer.current) clearTimeout(serverSyncTimer.current);
        serverSyncTimer.current = setTimeout(() => {
          void syncToServer(latestContentRef.current);
        }, SERVER_SYNC_DEBOUNCE_MS);
      } else {
        setDraftStatus('will_sync_when_online');
      }
    },
    [isReady, token, saveLocal, syncToServer],
  );

  // ---------- Offline submit intent ----------

  const handleSubmitIntent = useCallback(
    (markdown: string): boolean => {
      if (!cardId || !userId || !workspaceId || !boardId) return false;

      if (socket.isConnected) {
        // Online path — caller submits normally via onSubmit callback
        return false;
      }

      // Offline path: generate a stable idempotency key (reused on reconnect replay)
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = crypto.randomUUID();
      }
      const idempotencyKey = idempotencyKeyRef.current;

      void saveDraft({
        userId,
        workspaceId,
        cardId,
        draftType: 'comment',
        contentMarkdown: markdown,
        intent: 'submit_pending',
        updatedAt: new Date().toISOString(),
      });

      // Enqueue with idempotency_key in body — the server deduplicates on replay
      messageQueue.enqueue({
        id: idempotencyKey,
        boardId,
        method: 'POST',
        url: `/api/v1/cards/${cardId}/comments`,
        body: { content: markdown, idempotency_key: idempotencyKey },
        enqueuedAt: Date.now(),
        meta: { draftType: 'comment', cardId, userId, workspaceId },
      });

      setDraftStatus('will_sync_when_online');
      return true; // caller must NOT call onSubmit — replay will handle it
    },
    [cardId, userId, workspaceId, boardId],
  );

  // ---------- Clear draft (after successful online submit) ----------

  const clearDraft = useCallback(() => {
    if (!cardId || !userId || !workspaceId) return;

    if (localSaveTimer.current) clearTimeout(localSaveTimer.current);
    if (serverSyncTimer.current) clearTimeout(serverSyncTimer.current);

    idempotencyKeyRef.current = null;

    void deleteDraft({ userId, workspaceId, cardId, draftType: 'comment' });
    if (token) {
      void (async () => {
        try {
          const { deleteServerDraft } = await import('../api');
          await deleteServerDraft({ cardId, draftType: 'comment', token });
        } catch {
          // Best-effort — missing draft on server is fine
        }
      })();
    }
    setRestoredDraft(null);
    setDraftStatus('idle');
  }, [cardId, userId, workspaceId, token]);

  // ---------- Retry failed server draft sync ----------

  const retrySync = useCallback(
    (markdown: string) => {
      if (!cardId || !token) return;
      void syncToServer(markdown);
    },
    [cardId, token, syncToServer],
  );

  // ---------- Discard draft ----------

  const discardDraft = useCallback(() => {
    if (!cardId || !userId || !workspaceId) return;

    if (localSaveTimer.current) clearTimeout(localSaveTimer.current);
    if (serverSyncTimer.current) clearTimeout(serverSyncTimer.current);

    idempotencyKeyRef.current = null;

    void deleteDraft({ userId, workspaceId, cardId, draftType: 'comment' });
    if (token) {
      void (async () => {
        try {
          const { deleteServerDraft } = await import('../api');
          await deleteServerDraft({ cardId, draftType: 'comment', token });
        } catch {
          // Best-effort
        }
      })();
    }
    setRestoredDraft(null);
    setDraftStatus('idle');
  }, [cardId, userId, workspaceId, token]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (localSaveTimer.current) clearTimeout(localSaveTimer.current);
      if (serverSyncTimer.current) clearTimeout(serverSyncTimer.current);
    };
  }, []);

  return {
    restoredDraft,
    draftStatus,
    onContentChange,
    handleSubmitIntent,
    clearDraft,
    retrySync,
    discardDraft,
  };
}
