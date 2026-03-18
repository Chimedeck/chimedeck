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
import { messageQueue } from '~/extensions/Realtime/client/messageQueue';
export type { DraftStatus } from './useOfflineDescriptionDraft';

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
   * True when the current draft has a submit_pending intent — the user pressed Comment
   * while offline and the POST has not yet been applied.
   * [why] Callers use this to show "Retry Post" instead of the generic "Retry" label.
   */
  isSubmitPending: boolean;
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

export function useOfflineCommentDraft({
  cardId,
  boardId,
  userId,
  workspaceId,
  token,
}: UseOfflineCommentDraftOptions): UseOfflineCommentDraftResult {
  const [restoredDraft, setRestoredDraft] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('idle');
  // [why] Track submit_pending state separately so the UI can show "Retry Post"
  // instead of the generic "Retry" label when a queued POST has not yet been applied.
  const [isSubmitPending, setIsSubmitPending] = useState(false);

  // Latest content ref — always current without recreating debounced callbacks
  const latestContentRef = useRef<string>('');
  const localSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ---------- Restore draft on card open ----------

  useEffect(() => {
    if (!isReady || !cardId || !userId || !workspaceId) {
      setRestoredDraft(null);
      setDraftStatus('idle');
      setIsSubmitPending(false);
      idempotencyKeyRef.current = null;
      return;
    }

    let cancelled = false;

    const restore = async () => {
      const local = await getDraft({ userId, workspaceId, cardId, draftType: 'comment' });

      if (cancelled) return;

      if (local?.contentMarkdown) {
        setRestoredDraft(local.contentMarkdown);
        const submitPending = local.intent === 'submit_pending';
        setIsSubmitPending(submitPending);
        setDraftStatus(submitPending ? 'will_sync_when_online' : 'saved_local');
      } else {
        setRestoredDraft(null);
        setIsSubmitPending(false);
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

    },
    [isReady, saveLocal],
  );

  // ---------- Offline submit intent ----------

  const handleSubmitIntent = useCallback(
    (markdown: string): boolean => {
      if (!cardId || !userId || !workspaceId || !boardId) return false;

      if (navigator.onLine) {
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

      setIsSubmitPending(true);
      setDraftStatus('will_sync_when_online');
      return true; // caller must NOT call onSubmit — replay will handle it
    },
    [cardId, userId, workspaceId, boardId],
  );

  // ---------- Clear draft (after successful online submit) ----------

  const clearDraft = useCallback(() => {
    if (!cardId || !userId || !workspaceId) return;

    if (localSaveTimer.current) clearTimeout(localSaveTimer.current);

    idempotencyKeyRef.current = null;

    void deleteDraft({ userId, workspaceId, cardId, draftType: 'comment' });
    setRestoredDraft(null);
    setIsSubmitPending(false);
    setDraftStatus('idle');
  }, [cardId, userId, workspaceId]);

  // ---------- Retry ----------

  const retrySync = useCallback(
    (markdown: string) => {
      if (!isSubmitPending || !cardId || !userId || !workspaceId || !boardId) return;
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
    },
    [cardId, isSubmitPending, userId, workspaceId, boardId],
  );

  // ---------- Discard draft ----------

  const discardDraft = useCallback(() => {
    if (!cardId || !userId || !workspaceId) return;

    if (localSaveTimer.current) clearTimeout(localSaveTimer.current);

    idempotencyKeyRef.current = null;

    void deleteDraft({ userId, workspaceId, cardId, draftType: 'comment' });
    setRestoredDraft(null);
    setIsSubmitPending(false);
    setDraftStatus('idle');
  }, [cardId, userId, workspaceId]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (localSaveTimer.current) clearTimeout(localSaveTimer.current);
    };
  }, []);

  return {
    restoredDraft,
    draftStatus,
    isSubmitPending,
    onContentChange,
    handleSubmitIntent,
    clearDraft,
    retrySync,
    discardDraft,
  };
}
