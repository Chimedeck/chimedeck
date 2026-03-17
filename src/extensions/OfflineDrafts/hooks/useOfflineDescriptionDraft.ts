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
import { listServerDrafts, upsertServerDraft } from '../api';
import { reconcileDraftForType } from '../reconcile';
import { messageQueue } from '~/extensions/Realtime/client/messageQueue';
import { socket } from '~/extensions/Realtime/client/socket';

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
// Debounce delay for background server sync
const SERVER_SYNC_DEBOUNCE_MS = 3_000;

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

  // Latest markdown content — kept in a ref so debounced callbacks always
  // close over the current value without needing to re-create them.
  const latestContentRef = useRef<string>('');

  const localSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const syncToServer = useCallback(
    async (markdown: string) => {
      if (!cardId || !token) return;
      setDraftStatus('syncing');
      try {
        await upsertServerDraft({
          cardId,
          draftType: 'description',
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
      return;
    }

    let cancelled = false;

    const restore = async () => {
      // 1. Immediately check IndexedDB (fast, works offline)
      const local = await getDraft({ userId, workspaceId, cardId, draftType: 'description' });

      if (cancelled) return;

      // 2. If online, also fetch server snapshot and reconcile
      if (socket.isConnected && token) {
        try {
          const serverDrafts = await listServerDrafts({ cardId, token });
          if (cancelled) return;
          const result = reconcileDraftForType({ local, serverDrafts, draftType: 'description' });

          if (result.source !== 'none' && result.contentMarkdown !== currentDescription) {
            setRestoredDraft(result.contentMarkdown);
            // If server had a newer draft, back-sync to local IndexedDB
            if (result.source === 'server' && result.contentMarkdown) {
              void saveDraft({
                userId,
                workspaceId,
                cardId,
                draftType: 'description',
                contentMarkdown: result.contentMarkdown,
                intent: result.intent ?? 'editing',
                updatedAt: result.updatedAt ?? new Date().toISOString(),
              });
            }
            setDraftStatus(result.source === 'server' ? 'synced' : 'saved_local');
          } else {
            setRestoredDraft(null);
            setDraftStatus('idle');
          }
          return;
        } catch {
          // Server fetch failed — fall through to local-only restore
        }
      }

      // 3. Local-only restore (offline or server unreachable)
      if (local && local.contentMarkdown !== currentDescription) {
        setRestoredDraft(local.contentMarkdown);
        setDraftStatus(
          local.intent === 'save_pending' ? 'will_sync_when_online' : 'saved_local',
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

      // Debounce server sync (only when online)
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

  // ---------- Offline save intent ----------

  const handleSaveIntent = useCallback(
    (markdown: string): boolean => {
      if (!cardId || !userId || !workspaceId) return false;

      if (socket.isConnected) {
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

      setDraftStatus('will_sync_when_online');
      return true; // caller must NOT call onSave — replay will handle it
    },
    [cardId, userId, workspaceId, boardId],
  );

  // ---------- Clear draft (after successful online save) ----------

  const clearDraft = useCallback(() => {
    if (!cardId || !userId || !workspaceId) return;

    // Cancel pending timers
    if (localSaveTimer.current) clearTimeout(localSaveTimer.current);
    if (serverSyncTimer.current) clearTimeout(serverSyncTimer.current);

    void deleteDraft({ userId, workspaceId, cardId, draftType: 'description' });
    if (token) {
      void (async () => {
        try {
          const { deleteServerDraft } = await import('../api');
          await deleteServerDraft({ cardId, draftType: 'description', token });
        } catch {
          // Best-effort — missing draft on server is not an error
        }
      })();
    }
    setRestoredDraft(null);
    setDraftStatus('idle');
  }, [cardId, userId, workspaceId, token]);

  // ---------- Retry failed sync ----------

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

    void deleteDraft({ userId, workspaceId, cardId, draftType: 'description' });
    if (token) {
      void (async () => {
        try {
          const { deleteServerDraft } = await import('../api');
          await deleteServerDraft({ cardId, draftType: 'description', token });
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
    handleSaveIntent,
    clearDraft,
    retrySync,
    discardDraft,
  };
}
