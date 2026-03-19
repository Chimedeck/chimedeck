// Hook that wires offline draft persistence and sync for the card description editor.
//
// WHY: isolating all IndexedDB + server-sync concerns here keeps CardDescriptionTiptap
// focused on rendering/UX. The hook owns the entire draft lifecycle:
//   - local persistence (debounced IndexedDB save on every keystroke)
//   - background server sync (debounced PUT when online)
//   - restore on card open (local-first, then reconcile with server snapshot)
//   - queued PATCH when Save is pressed while offline
//   - status that drives the footer UI
import { useState, useEffect, useCallback, useRef } from 'react';
import { getDraft, saveDraft, deleteDraft } from '../storage';
import { messageQueue } from '~/extensions/Realtime/client/messageQueue';

export type DraftStatus =
  | 'idle'
  | 'saving_local'
  | 'saved_local'
  | 'syncing'
  | 'synced'
  | 'will_sync_when_online'
  | 'sync_failed';

export interface UseOfflineDescriptionDraftOptions {
  cardId: string | undefined;
  boardId: string;
  userId: string | undefined;
  workspaceId: string | undefined;
  token: string | undefined;
  /** Current saved description (server truth) — used to skip restore when no draft exists. */
  currentDescription: string;
}

export interface UseOfflineDescriptionDraftResult {
  /** Winning draft content to initialise the editor with, null means "use currentDescription". */
  restoredDraft: string | null;
  draftStatus: DraftStatus;
  /**
   * True when the current draft has a save_pending intent — i.e. the user pressed Save
   * while offline and the PATCH has not yet been applied.
   * [why] Callers use this to show "Retry Save" instead of the generic "Retry" label.
   */
  isSavePending: boolean;
  /**
   * Call this on every editor change (after your own state update).
   * Internally debounced — safe to call on every keystroke.
   */
  onContentChange: (markdown: string) => void;
  /**
   * Call when the user presses Save.
   * Returns true if the save was handled offline (caller should NOT call onSave
   * themselves — the queued mutation will replay it). Returns false when online
   * (caller should proceed with the normal onSave flow and then call clearDraft).
   */
  handleSaveIntent: (markdown: string) => boolean;
  /** Clear both local and server drafts (call after a successful online save). */
  clearDraft: () => void;
  /** Retry a failed server sync manually (bound to "Retry" button in footer). */
  retrySync: (markdown: string) => void;
  /** Discard the draft entirely (bound to "Discard" button in footer). */
  discardDraft: () => void;
}

// Debounce delay for local IndexedDB persistence
const LOCAL_SAVE_DEBOUNCE_MS = 800;

export function useOfflineDescriptionDraft({
  cardId,
  boardId,
  userId,
  workspaceId,
  token,
  currentDescription,
}: UseOfflineDescriptionDraftOptions): UseOfflineDescriptionDraftResult {
  const [restoredDraft, setRestoredDraft] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('idle');
  // [why] Track save_pending state separately so the UI can show "Retry Save"
  // instead of the generic "Retry" label when a queued PATCH has not yet been applied.
  const [isSavePending, setIsSavePending] = useState(false);

  // Latest markdown content — kept in a ref so debounced callbacks always
  // close over the current value without needing to re-create them.
  const latestContentRef = useRef<string>('');

  const localSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- Helpers ----------

  const isReady = Boolean(cardId && userId && workspaceId);

  const saveLocal = useCallback(
    async (markdown: string) => {
      if (!cardId || !userId || !workspaceId) return;
      await saveDraft({
        userId,
        workspaceId,
        cardId,
        draftType: 'description',
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
      setIsSavePending(false);
      return;
    }

    let cancelled = false;

    const restore = async () => {
      const local = await getDraft({ userId, workspaceId, cardId, draftType: 'description' });

      if (cancelled) return;

      if (local && local.contentMarkdown !== currentDescription) {
        setRestoredDraft(local.contentMarkdown);
        const savePending = local.intent === 'save_pending';
        setIsSavePending(savePending);
        setDraftStatus(savePending ? 'will_sync_when_online' : 'saved_local');
      } else {
        setRestoredDraft(null);
        setDraftStatus('idle');
        setIsSavePending(false);
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
    // [why] Only re-run when the card changes — not on every description change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, userId, workspaceId, token]);

  // ---------- Debounced local + server persistence on content change ----------

  const onContentChange = useCallback(
    (markdown: string) => {
      if (!isReady) return;
      latestContentRef.current = markdown;
      setDraftStatus('saving_local');

      // Debounce local save
      if (localSaveTimer.current) clearTimeout(localSaveTimer.current);
      localSaveTimer.current = setTimeout(() => {
        void saveLocal(latestContentRef.current);
      }, LOCAL_SAVE_DEBOUNCE_MS);

    },
    [isReady, saveLocal],
  );

  // ---------- Offline save intent ----------

  const handleSaveIntent = useCallback(
    (markdown: string): boolean => {
      if (!cardId || !userId || !workspaceId) return false;

      if (navigator.onLine) {
        // Online path — caller proceeds with normal onSave; clearDraft is their responsibility
        return false;
      }

      // Offline path: persist save_pending locally and queue a PATCH for replay
      const mutationId = crypto.randomUUID();
      void saveDraft({
        userId,
        workspaceId,
        cardId,
        draftType: 'description',
        contentMarkdown: markdown,
        intent: 'save_pending',
        updatedAt: new Date().toISOString(),
      });

      messageQueue.enqueue({
        id: mutationId,
        boardId,
        method: 'PATCH',
        url: `/api/v1/cards/${cardId}`,
        body: { description: markdown },
        enqueuedAt: Date.now(),
        meta: { draftType: 'description', cardId, userId, workspaceId },
      });

      setIsSavePending(true);
      setDraftStatus('will_sync_when_online');
      return true; // caller must NOT call onSave — replay will handle it
    },
    [cardId, userId, workspaceId, boardId],
  );

  // ---------- Clear draft (after successful online save) ----------

  const clearDraft = useCallback(() => {
    if (!cardId || !userId || !workspaceId) return;

    if (localSaveTimer.current) clearTimeout(localSaveTimer.current);

    void deleteDraft({ userId, workspaceId, cardId, draftType: 'description' });
    setRestoredDraft(null);
    setIsSavePending(false);
    setDraftStatus('idle');
  }, [cardId, userId, workspaceId]);

  // ---------- Retry ----------

  const retrySync = useCallback(
    (markdown: string) => {
      if (!isSavePending || !cardId || !userId || !workspaceId) return;
      const mutationId = crypto.randomUUID();
      void saveDraft({
        userId,
        workspaceId,
        cardId,
        draftType: 'description',
        contentMarkdown: markdown,
        intent: 'save_pending',
        updatedAt: new Date().toISOString(),
      });
      messageQueue.enqueue({
        id: mutationId,
        boardId,
        method: 'PATCH',
        url: `/api/v1/cards/${cardId}`,
        body: { description: markdown },
        enqueuedAt: Date.now(),
        meta: { draftType: 'description', cardId, userId, workspaceId },
      });
      setDraftStatus('will_sync_when_online');
    },
    [cardId, isSavePending, userId, workspaceId, boardId],
  );

  // ---------- Discard draft ----------

  const discardDraft = useCallback(() => {
    if (!cardId || !userId || !workspaceId) return;

    if (localSaveTimer.current) clearTimeout(localSaveTimer.current);

    void deleteDraft({ userId, workspaceId, cardId, draftType: 'description' });
    setRestoredDraft(null);
    setIsSavePending(false);
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
    isSavePending,
    onContentChange,
    handleSaveIntent,
    clearDraft,
    retrySync,
    discardDraft,
  };
}
