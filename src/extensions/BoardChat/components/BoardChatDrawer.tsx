// BoardChatDrawer — right-side slide-in drawer for board chat history and composition.
// Sprint 164: Shows loading/empty/error states; sticky composer footer shell.
// Sprint 165: Wires real history endpoint and message send.
// Sprint 199: Session-scoped chat — users must create/select a session before chatting.
// Sprint 208: Real-time AI progress streaming via WebSocket — replaces static
// typing indicator with per-iteration phase labels and tool names.

import { useEffect, useState, useRef } from 'react';
import type React from 'react';
import { useBoardChatHistory } from '../hooks/useBoardChatHistory';
import { LockClosedIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { apiClient } from '~/common/api/client';
import { socket } from '~/extensions/Realtime/client/socket';
import type { RealtimeEvent } from '~/extensions/Realtime/client/socket';
import Button from '~/common/components/Button';
import IconButton from '~/common/components/IconButton';
import {
  createBoardChatMessage,
  requestBoardChatAssist,
  getBoardChatPermissions,
  patchBoardChatPermissions,
  commitBoardChatProposals,
  listBoardChatSessions,
  createBoardChatSession,
  type BoardChatPermissions,
  type BoardChatAssistActionCard,
  type BoardChatAssistCommitProposal,
  type BoardChatSession,
} from '../api';
import type { GuestType } from '~/extensions/Board/mods/guestPermissions';
import translations from '../translations/en.json';

interface Props {
  boardId: string;
  isGuest?: boolean;
  callerGuestType?: GuestType | null;
  canManageGuestPermissions?: boolean;
  onClose: () => void;
  onDocsChanged?: () => void;
}

const normalizePermissions = (input: Pick<BoardChatPermissions, 'guest_can_view' | 'guest_can_use'>) => {
  let guest_can_view = input.guest_can_view;
  let guest_can_use = input.guest_can_use;

  if (guest_can_use) {
    guest_can_view = true;
  }

  if (!guest_can_view) {
    guest_can_use = false;
  }

  return { guest_can_view, guest_can_use };
};

const BoardChatDrawer = ({
  boardId,
  isGuest = false,
  callerGuestType = null,
  canManageGuestPermissions = false,
  onClose,
  onDocsChanged,
}: Props) => {
  const [permissions, setPermissions] = useState<Pick<BoardChatPermissions, 'guest_can_view' | 'guest_can_use'> | null>(null);
  const [permissionsState, setPermissionsState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [updatingPermissions, setUpdatingPermissions] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [aiTyping, setAiTyping] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [actionCards, setActionCards] = useState<BoardChatAssistActionCard[]>([]);
  const [committingCards, setCommittingCards] = useState<Set<string>>(new Set());
  const [commitError, setCommitError] = useState<string | null>(null);
  const [dismissedCards, setDismissedCards] = useState<Set<string>>(new Set());
  // Sprint 199 — session-scoped chat
  const [sessions, setSessions] = useState<BoardChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  // Sprint 208 — real-time AI progress streaming
  const [aiProgress, setAiProgress] = useState<{
    phase: 'thinking' | 'executing_tools' | 'done';
    toolNames?: string[] | undefined;
    message?: string | undefined;
    // [why] Document paths streamed from propose_github_document tool calls
    // so the client can show "Creating specs/pricing.md…" instead of just
    // "Running: propose_github_document" with bouncing dots.
    documentPaths?: string[] | undefined;
  } | null>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const guestCanView = permissions?.guest_can_view === true;
  const guestCanUse = permissions?.guest_can_use === true;
  const historyEnabled = !!boardId && !!activeSessionId && (!isGuest || (permissionsState === 'loaded' && guestCanView));
  const { messages, state, error } = useBoardChatHistory({ boardId, sessionId: activeSessionId ?? undefined, enabled: historyEnabled, refreshKey });

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;

    setPermissionsState('loading');
    setPermissionsError(null);

    void getBoardChatPermissions({
      api: apiClient as { get: <T>(url: string) => Promise<T> },
      boardId,
    })
      .then((res) => {
        if (cancelled) return;
        setPermissions(
          normalizePermissions({
            guest_can_view: res.data.guest_can_view,
            guest_can_use: res.data.guest_can_use,
          }),
        );
        setPermissionsState('loaded');
      })
      .catch(() => {
        if (cancelled) return;
        setPermissions({ guest_can_view: false, guest_can_use: false });
        setPermissionsState('error');
        setPermissionsError(translations['BoardChat.drawer.updatePermissionsError']);
      });

    return () => {
      cancelled = true;
    };
  }, [boardId]);

  // Scroll to latest message when new ones arrive
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // [why] Subscribe to realtime AI progress events so the chat drawer shows
  // per-iteration streaming updates (phase labels, tool names) instead of a
  // static typing indicator for the entire multi-minute tool-use loop.
  useEffect(() => {
    if (!boardId) return;

    const handleProgress = (event: RealtimeEvent) => {
      if (event.type !== 'board_chat.assist_progress') return;
      const payload = event.payload as {
        sessionId: string;
        phase: 'thinking' | 'executing_tools' | 'done';
        toolNames?: string[];
        message?: string;
        actionCards?: BoardChatAssistActionCard[];
        documentPaths?: string[];
      } | null;
      if (!payload) return;
      // [why] Only process events for the active session to avoid cross-session bleed.
      if (payload.sessionId !== activeSessionId) return;

      if (payload.phase === 'done') {
        setAiProgress(null);
        return;
      }

      setAiProgress({
        phase: payload.phase,
        toolNames: payload.toolNames,
        message: payload.message,
        documentPaths: payload.documentPaths,
      });

      // [why] Action cards arrive progressively — append them as they come
      // so document proposals appear in realtime during the loop.
      if (payload.actionCards && payload.actionCards.length > 0) {
        const incomingCards = payload.actionCards;
        setActionCards((prev) => {
          const existingKeys = new Set(prev.map((c) => c.idempotencyKey));
          const newCards = incomingCards.filter(
            (c) => !existingKeys.has(c.idempotencyKey)
          );
          return newCards.length > 0 ? [...prev, ...newCards] : prev;
        });
      }
    };

    const unsubscribe = socket.subscribe({ onEvent: handleProgress });
    return unsubscribe;
  }, [boardId, activeSessionId]);

  // [why] Clear progress when AI typing ends (HTTP response received).
  useEffect(() => {
    if (!aiTyping) {
      setAiProgress(null);
    }
  }, [aiTyping]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const controlsLocked = !canManageGuestPermissions || permissionsState !== 'loaded' || updatingPermissions;
  const isGuestDeniedHistory = isGuest && permissionsState === 'loaded' && !guestCanView;
  const isGuestComposerDenied = isGuest && permissionsState === 'loaded' && !guestCanUse;
  const isPermissionCheckPendingForGuest = isGuest && permissionsState !== 'loaded';
  const composerDisabled = isPermissionCheckPendingForGuest || isGuestComposerDenied || sendingMessage;

  const applyPermissionPatch = async (
    updater: (current: Pick<BoardChatPermissions, 'guest_can_view' | 'guest_can_use'>) => Pick<BoardChatPermissions, 'guest_can_view' | 'guest_can_use'>,
  ) => {
    if (!permissions || controlsLocked) return;

    setPermissionsError(null);
    const previous = permissions;
    const next = normalizePermissions(updater(previous));
    setPermissions(next);
    setUpdatingPermissions(true);

    try {
      const res = await patchBoardChatPermissions({
        api: apiClient as { patch: <T>(url: string, data: unknown) => Promise<T> },
        boardId,
        body: next,
      });
      setPermissions(
        normalizePermissions({
          guest_can_view: res.data.guest_can_view,
          guest_can_use: res.data.guest_can_use,
        }),
      );
    } catch {
      setPermissions(previous);
      setPermissionsError('Failed to update chat permissions');
    } finally {
      setUpdatingPermissions(false);
    }
  };

  const triggerAiAssist = async (prompt: string, sessionId: string): Promise<void> => {
    setAiResponse(null);
    setActionCards([]);
    setAiTyping(true);
    try {
      const res = await requestBoardChatAssist({
        api: apiClient as { post: <T>(url: string, data: unknown) => Promise<T> },
        boardId,
        sessionId,
        prompt,
      });
      setAiResponse(res.data.message ?? null);
      // [why] Capture action cards (document proposals, card creations) from
      // the AI response so they can be displayed in the chat drawer.
      const cards: BoardChatAssistActionCard[] = [];
      if (res.data.actionCard) cards.push(res.data.actionCard);
      if (res.data.actionCards) cards.push(...res.data.actionCards);
      setActionCards(cards);
      // [why] If the AI proposed or modified documentation, notify the parent
      // so the Documentation tab can reload its file tree.
      if (cards.length > 0 && onDocsChanged) {
        onDocsChanged();
      }
    } catch {
      setAiResponse(null);
      setActionCards([]);
    } finally {
      setAiTyping(false);
      // [why] AI response is now persisted server-side in assistBoardChat.
      // Bump refreshKey so history reload picks up the persisted AI message
      // for future drawer opens. The inline aiResponse stays visible for
      // immediate feedback during the current session.
      setRefreshKey((current) => current + 1);
    }
  };

  const handleSendMessage = async (): Promise<void> => {
    const trimmed = composerText.trim();
    if (!trimmed || composerDisabled) return;

    // [why] Auto-create a session on the first message — the user
    // shouldn't have to manually create a session before chatting.
    let sessionId = activeSessionId;
    if (!sessionId) {
      setCreatingSession(true);
      try {
        const res = await createBoardChatSession({
          api: apiClient as { post: <T>(url: string, data: unknown) => Promise<T> },
          boardId,
        });
        sessionId = res.data.id;
        setSessions((prev) => [...prev, res.data]);
        setActiveSessionId(sessionId);
      } catch {
        setSendError(translations['BoardChat.drawer.createSessionError']);
        return;
      } finally {
        setCreatingSession(false);
      }
    }

    setSendError(null);
    setSendingMessage(true);
    try {
      await createBoardChatMessage({
        api: apiClient as { post: <T>(url: string, data: unknown) => Promise<T> },
        boardId,
        sessionId,
        content: trimmed,
      });
      setComposerText('');
      setRefreshKey((current) => current + 1);
    } catch {
      setSendError(translations['BoardChat.drawer.sendError']);
      return;
    } finally {
      setSendingMessage(false);
    }
    await triggerAiAssist(trimmed, sessionId);
  };

  // [why] Commit confirmed document proposals to the board's GitHub repository.
  // Builds the payload from the action card's in-memory content and calls the
  // server commit endpoint. Updates the action card state on success.
  const handleCommitProposal = async (card: BoardChatAssistActionCard): Promise<void> => {
    if (!card.documentPath || !card.documentContent || !card.commitMessage) return;
    if (!activeSessionId) return;

    setCommitError(null);
    setCommittingCards((prev) => new Set(prev).add(card.idempotencyKey));

    try {
      const proposal: BoardChatAssistCommitProposal = {
        toolCallId: card.toolCallId,
        idempotencyKey: card.idempotencyKey,
        path: card.documentPath,
        content: card.documentContent,
        commitMessage: card.commitMessage,
      };

      await commitBoardChatProposals({
        api: apiClient as { post: <T>(url: string, data: unknown) => Promise<T> },
        boardId,
        sessionId: activeSessionId,
        proposals: [proposal],
      });

      // [why] Mark as confirmed so the UI shows success state and the
      // Documentation tab can pick up the new file on next refresh.
      setActionCards((prev) =>
        prev.map((c) =>
          c.idempotencyKey === card.idempotencyKey
            ? { ...c, state: 'confirmed' as const }
            : c,
        ),
      );

      if (onDocsChanged) onDocsChanged();
    } catch (err) {
      // [why] Extract the server's structured error message for 409
      // (session-instance-mismatch) so the user sees a clear explanation
      // instead of a generic "Request failed" message.
      const axiosErr = err as { response?: { status?: number; data?: unknown } };
      if (axiosErr.response?.status === 409 && axiosErr.response.data) {
        const data = axiosErr.response.data as { name?: string; data?: { message?: string } };
        if (data.name === 'session-instance-mismatch' && data.data?.message) {
          setCommitError(data.data.message);
          return;
        }
      }
      setCommitError(err instanceof Error ? err.message : translations['BoardChat.drawer.commitErrorFallback']);
    } finally {
      setCommittingCards((prev) => {
        const next = new Set(prev);
        next.delete(card.idempotencyKey);
        return next;
      });
    }
  };

  // [why] Dismiss a proposal without committing — removes it from the visible
  // action cards list so the user can clear proposals they don't want.
  const handleDismissProposal = (card: BoardChatAssistActionCard): void => {
    setDismissedCards((prev) => new Set(prev).add(card.idempotencyKey));
  };

  // Sprint 199 — fetch board chat sessions on mount
  useEffect(() => {
    if (!boardId || isGuest) return;
    let cancelled = false;

    const fetchSessions = async () => {
      setSessionsLoading(true);
      try {
        const res = await listBoardChatSessions({
          api: apiClient as { get: <T>(url: string) => Promise<T> },
          boardId,
        });
        if (cancelled) return;
        setSessions(res.data);
        // [why] Never auto-select a session — sessions are created
        // automatically when the user sends their first message.
        setActiveSessionId(null);
      } catch {
        if (cancelled) return;
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    };

    void fetchSessions();

    return () => {
      cancelled = true;
    };
  }, [boardId, isGuest]);

  const handleCreateSession = async (): Promise<void> => {
    setCreatingSession(true);
    try {
      const res = await createBoardChatSession({
        api: apiClient as { post: <T>(url: string, data: unknown) => Promise<T> },
        boardId,
      });
      setSessions((prev) => [...prev, res.data]);
      setActiveSessionId(res.data.id);
    } catch {
      // Silently fail — UI will show empty state
    } finally {
      setCreatingSession(false);
    }
  };

  return (
    // Backdrop — click to close
    <div
      className="fixed inset-0 z-30 bg-black/50"
      onClick={onClose}
      aria-label={translations['BoardChat.drawer.closeBackdropAria']}
    >
      {/* Drawer panel — stop propagation so clicks inside don't close */}
      <div
        className="absolute right-0 top-0 h-full w-96 bg-bg-base border-l border-border flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={translations['BoardChat.drawer.dialogAria']}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-base font-semibold">{translations['BoardChat.drawer.title']}</h2>
          <IconButton
            aria-label={translations['BoardChat.drawer.closeButtonAria']}
            icon={<XMarkIcon className="h-5 w-5" />}
            onClick={onClose}
          />
        </div>

        {/* Session selector bar — Sprint 199 */}
        {!isGuest && (
          <div className="px-4 py-2 border-b border-border bg-bg-surface flex items-center gap-2">
            {/* Session dropdown */}
            <select
              value={activeSessionId ?? ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                const val = e.target.value;
                if (val === '__new__') {
                  void handleCreateSession();
                  return;
                }
                if (val === '') {
                  setActiveSessionId(null);
                } else {
                  setActiveSessionId(val);
                  // [why] Refresh messages when switching sessions.
                  setRefreshKey((k) => k + 1);
                }
              }}
              className="flex-1 rounded-md border border-border bg-bg-base px-2 py-1.5 text-xs text-base focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={sessionsLoading}
            >
              <option value="">— Start a new session —</option>
              {sessions.length === 0 && (
                <option value="__new__">{translations['BoardChat.drawer.createFirstSession']}</option>
              )}
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ? s.name : translations['BoardChat.drawer.sessionLabel'].replace('{id}', s.id.slice(0, 8))} — {s.last_message_at ? new Date(s.last_message_at).toLocaleDateString() : translations['BoardChat.drawer.sessionDateEmpty']}
                </option>
              ))}
            </select>

            {/* New session button */}
            <Button
              variant="primary"
              size="sm"
              disabled={creatingSession}
              onClick={() => { void handleCreateSession(); }}
              title={translations['BoardChat.drawer.newSessionTitle']}
              className="gap-1 flex-shrink-0"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {translations['BoardChat.drawer.newSessionButton']}
            </Button>
          </div>
        )}

        {/* History area — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <div className="rounded-md border border-border bg-bg-surface px-3 py-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{translations['BoardChat.drawer.guestAccessHeading']}</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={controlsLocked}
                onClick={() => {
                  void applyPermissionPatch((current) => ({
                    guest_can_view: !current.guest_can_view,
                    guest_can_use: current.guest_can_use,
                  }));
                }}
                className={`w-full rounded-md border px-3 py-2 text-xs font-semibold tracking-wide transition-colors ${
                  permissions?.guest_can_view
                    ? 'border-indigo-600 bg-indigo-600 text-inverse'
                    : 'border-border bg-bg-base text-subtle hover:bg-bg-overlay'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {translations['BoardChat.drawer.allowGuestView']}
              </button>
              <button
                type="button"
                disabled={controlsLocked}
                onClick={() => {
                  void applyPermissionPatch((current) => ({
                    guest_can_view: current.guest_can_view,
                    guest_can_use: !current.guest_can_use,
                  }));
                }}
                className={`w-full rounded-md border px-3 py-2 text-xs font-semibold tracking-wide transition-colors ${
                  permissions?.guest_can_use
                    ? 'border-indigo-600 bg-indigo-600 text-inverse'
                    : 'border-border bg-bg-base text-subtle hover:bg-bg-overlay'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {translations['BoardChat.drawer.allowGuestUse']}
              </button>
            </div>
            {!canManageGuestPermissions && (
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <LockClosedIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {translations['BoardChat.drawer.guestPermissionLocked']}
              </p>
            )}
            {isGuest && (
              <p className="text-xs text-muted">
                {translations['BoardChat.drawer.guestSelfNotice']}{callerGuestType ? ` (${callerGuestType})` : ''}.
              </p>
            )}
            {permissionsError && <p className="text-xs text-danger">{permissionsError}</p>}
          </div>

          {isPermissionCheckPendingForGuest && (
            <div className="flex items-center justify-center h-24">
              <p className="text-muted text-sm">{translations['BoardChat.drawer.checkingGuestAccess']}</p>
            </div>
          )}

          {isGuestDeniedHistory && (
            <div className="flex items-center justify-center h-24">
              <p className="text-muted text-sm">{translations['BoardChat.drawer.guestDeniedHistory']}</p>
            </div>
          )}

          {!isPermissionCheckPendingForGuest && !isGuestDeniedHistory && state === 'loading' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted text-sm">{translations['BoardChat.drawer.loadingHistory']}</p>
            </div>
          )}

          {!isPermissionCheckPendingForGuest && !isGuestDeniedHistory && state === 'empty' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted text-sm">{translations['BoardChat.drawer.emptyState']}</p>
            </div>
          )}

          {!isPermissionCheckPendingForGuest && !isGuestDeniedHistory && state === 'error' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-500 text-sm">{error || translations['BoardChat.drawer.loadErrorFallback']}</p>
            </div>
          )}

          {!isPermissionCheckPendingForGuest && !isGuestDeniedHistory && state === 'loaded' && messages.length > 0 && (
            <ul className="space-y-3">
              {messages.map((msg) => (
                <li
                  key={msg.id}
                  className={`rounded-md p-3 ${
                    msg.isAssistant
                      ? 'bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800'
                      : 'bg-bg-overlay'
                  }`}
                >
                  <div className="flex gap-2">
                    {msg.isAssistant ? (
                      <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-white">{translations['BoardChat.drawer.aiBadge']}</span>
                      </div>
                    ) : msg.avatar ? (
                      <img
                        src={msg.avatar}
                        alt={msg.userName}
                        className="h-6 w-6 rounded-full flex-shrink-0"
                      />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${msg.isAssistant ? 'text-indigo-700 dark:text-indigo-300' : 'text-base'}`}>
                        {msg.userName}
                      </p>
                      <p className="text-xs text-muted">{new Date(msg.createdAt).toLocaleTimeString()}</p>
                      <p className="text-sm text-base break-words mt-1 whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* AI typing / progress indicator — shows realtime phase and tool names when streaming */}
          {aiTyping && (
            <ul className="space-y-3">
              <li className="rounded-md bg-bg-overlay p-3">
                <div className="flex gap-2 items-start">
                  <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-white">{translations['BoardChat.drawer.aiBadge']}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {aiProgress ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                          {aiProgress.phase === 'thinking' && translations['BoardChat.drawer.thinking']}
                          {aiProgress.phase === 'executing_tools' && (
                            aiProgress.toolNames && aiProgress.toolNames.length > 0
                              ? translations['BoardChat.drawer.runningTools'].replace('{tools}', aiProgress.toolNames.map((n) => n.replace(/_/g, ' ')).join(', '))
                              : translations['BoardChat.drawer.executingTools']
                          )}
                        </p>
                        {/* [why] Show document paths being created so the user sees
                            "Creating specs/pricing.md…" instead of just bouncing dots */}
                        {aiProgress.documentPaths && aiProgress.documentPaths.length > 0 && (
                          <ul className="space-y-0.5">
                            {aiProgress.documentPaths.map((path) => (
                              <li key={path} className="text-xs text-indigo-500 dark:text-indigo-400 font-mono flex items-center gap-1">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                {translations['BoardChat.drawer.creatingDoc'].replace('{path}', path)}
                              </li>
                            ))}
                          </ul>
                        )}
                        {aiProgress.message && (
                          <p className="text-xs text-muted">{aiProgress.message}</p>
                        )}
                        <div className="flex gap-1 items-center h-4">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-1 items-center h-4">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce [animation-delay:300ms]" />
                      </div>
                    )}
                  </div>
                </div>
              </li>
            </ul>
          )}

          {/* [why] Commit error displayed as a standalone chat message so it
              persists even after the user dismisses the action cards. This
              ensures the "session timed out, re-prompt" message remains visible
              in the chat history. */}
          {!aiTyping && commitError && (
            <ul className="space-y-3">
              <li className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
                <div className="flex gap-2">
                  <div className="h-6 w-6 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-white">!</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300">{translations['BoardChat.drawer.commitErrorTitle']}</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{commitError}</p>
                  </div>
                </div>
              </li>
            </ul>
          )}

          {/* Action cards — document proposals and card creations from AI */}
          {!aiTyping && actionCards.some((c) => !dismissedCards.has(c.idempotencyKey)) && (
            <ul className="space-y-3">
              {actionCards
                .filter((c) => !dismissedCards.has(c.idempotencyKey))
                .map((card) => {
                  const isCommitting = committingCards.has(card.idempotencyKey);
                  const isConfirmed = card.state === 'confirmed';
                  return (
                    <li
                      key={card.idempotencyKey}
                      className={`rounded-md border p-3 ${
                        isConfirmed
                          ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                          : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
                      }`}
                    >
                      <div className="flex gap-2">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isConfirmed ? 'bg-green-600' : 'bg-indigo-600'
                        }`}>
                          <span className="text-[10px] font-bold text-white">
                            {isConfirmed ? '✓' : translations['BoardChat.drawer.aiBadge']}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${
                            isConfirmed ? 'text-green-700 dark:text-green-300' : 'text-indigo-700 dark:text-indigo-300'
                          }`}>{translations['BoardChat.drawer.boardAiLabel']}</p>
                          {card.toolName === 'propose_github_document' && card.documentPath && (
                            <div className="mt-1">
                              <p className={`text-xs font-mono ${
                                isConfirmed ? 'text-green-600 dark:text-green-400' : 'text-indigo-600 dark:text-indigo-400'
                              }`}>
                                {isConfirmed ? translations['BoardChat.drawer.committedPrefix'] : translations['BoardChat.drawer.proposedPrefix']}<code>{card.documentPath}</code>
                              </p>
                              {card.documentContent && !isConfirmed && (
                                <details className="mt-1">
                                  <summary className="text-xs text-indigo-500 cursor-pointer hover:text-indigo-700">
                                    {translations['BoardChat.drawer.viewContent'].replace('{length}', String(card.documentContent.length))}
                                  </summary>
                                  <pre className="mt-1 text-xs text-base bg-bg-base rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                                    {card.documentContent}
                                  </pre>
                                </details>
                              )}
                              {card.commitMessage && (
                                <p className="text-xs text-muted mt-1">
                                  {translations['BoardChat.drawer.commitLabel']} {card.commitMessage}
                                </p>
                              )}
                              {/* Confirm / Dismiss buttons — only for suggested proposals */}
                              {!isConfirmed && (
                                <div className="flex gap-2 mt-2">
                                  <Button
                                    variant="success"
                                    size="sm"
                                    disabled={isCommitting}
                                    onClick={() => { void handleCommitProposal(card); }}
                                  >
                                    {isCommitting ? translations['BoardChat.drawer.committing'] : translations['BoardChat.drawer.confirmAndCommit']}
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={isCommitting}
                                    onClick={() => handleDismissProposal(card)}
                                  >
                                    {translations['BoardChat.drawer.dismiss']}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          {card.toolName === 'create_board_card' && card.cardTitle && (
                            <div className="mt-1">
                              <p className="text-xs text-indigo-600 dark:text-indigo-400">
                                {translations['BoardChat.drawer.createdCardPrefix']}<strong>{card.cardTitle}</strong>
                                {card.listName ? ` in ${card.listName}` : ''}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
          {/* Scroll anchor */}
          <div ref={historyEndRef} />
        </div>

        {/* Sticky composer footer */}
        <div className="border-t border-border bg-bg-surface px-4 py-3 flex-shrink-0">
          <div className="flex gap-2">
            <textarea
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              disabled={composerDisabled}
              placeholder={
                isPermissionCheckPendingForGuest
                  ? translations['BoardChat.drawer.composerPlaceholderChecking']
                  : isGuestComposerDenied
                    ? translations['BoardChat.drawer.composerPlaceholderGuestDenied']
                    : translations['BoardChat.drawer.composerPlaceholder']
              }
              className="flex-1 rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-base placeholder-muted resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
            />
            <Button
              variant="primary"
              size="sm"
              className="self-end"
              disabled={composerDisabled || !composerText.trim()}
              onClick={() => { void handleSendMessage(); }}
            >
              {translations['BoardChat.drawer.send']}
            </Button>
          </div>
          {isGuestComposerDenied && (
            <p className="mt-2 text-xs text-muted">{translations['BoardChat.drawer.guestComposerDenied']}</p>
          )}
          {sendError && <p className="mt-2 text-xs text-danger">{sendError}</p>}
        </div>
      </div>
    </div>
  );
};

export default BoardChatDrawer;
