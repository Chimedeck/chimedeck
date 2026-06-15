// BoardChatDrawer — right-side slide-in drawer for board chat history and composition.
// Sprint 164: Shows loading/empty/error states; sticky composer footer shell.
// Sprint 165: Wires real history endpoint and message send.

import { useEffect, useState, useRef } from 'react';
import { useBoardChatHistory } from '../hooks/useBoardChatHistory';
import { LockClosedIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { apiClient } from '~/common/api/client';
import {
  createBoardChatMessage,
  requestBoardChatAssist,
  getBoardChatPermissions,
  patchBoardChatPermissions,
  commitBoardChatProposals,
  type BoardChatPermissions,
  type BoardChatAssistActionCard,
  type BoardChatAssistCommitProposal,
} from '../api';
import type { GuestType } from '~/extensions/Board/mods/guestPermissions';

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
  const historyEndRef = useRef<HTMLDivElement>(null);
  const guestCanView = permissions?.guest_can_view === true;
  const guestCanUse = permissions?.guest_can_use === true;
  const historyEnabled = !!boardId && (!isGuest || (permissionsState === 'loaded' && guestCanView));
  const { messages, state, error } = useBoardChatHistory({ boardId, enabled: historyEnabled, refreshKey });

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
        setPermissionsError('Failed to load chat permissions');
      });

    return () => {
      cancelled = true;
    };
  }, [boardId]);

  // Scroll to latest message when new ones arrive
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const triggerAiAssist = async (prompt: string): Promise<void> => {
    setAiResponse(null);
    setActionCards([]);
    setAiTyping(true);
    try {
      const res = await requestBoardChatAssist({
        api: apiClient as { post: <T>(url: string, data: unknown) => Promise<T> },
        boardId,
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

    setSendError(null);
    setSendingMessage(true);
    try {
      await createBoardChatMessage({
        api: apiClient as { post: <T>(url: string, data: unknown) => Promise<T> },
        boardId,
        content: trimmed,
      });
      setComposerText('');
      setRefreshKey((current) => current + 1);
    } catch {
      setSendError('Failed to send message');
      return;
    } finally {
      setSendingMessage(false);
    }
    await triggerAiAssist(trimmed);
  };

  // [why] Commit confirmed document proposals to the board's GitHub repository.
  // Builds the payload from the action card's in-memory content and calls the
  // server commit endpoint. Updates the action card state on success.
  const handleCommitProposal = async (card: BoardChatAssistActionCard): Promise<void> => {
    if (!card.documentPath || !card.documentContent || !card.commitMessage) return;

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
      setCommitError(err instanceof Error ? err.message : 'Failed to commit proposal');
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

  return (
    // Backdrop — click to close
    <div
      className="fixed inset-0 z-30 bg-black/50"
      onClick={onClose}
      aria-label="Close board chat drawer"
    >
      {/* Drawer panel — stop propagation so clicks inside don't close */}
      <div
        className="absolute right-0 top-0 h-full w-96 bg-bg-base border-l border-border flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Board Chat"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-base font-semibold">Board Chat</h2>
          <button
            className="text-muted hover:text-subtle transition-colors"
            onClick={onClose}
            aria-label="Close board chat"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* History area — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <div className="rounded-md border border-border bg-bg-surface px-3 py-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">GUEST ACCESS (MEMBER ONLY)</p>
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
                ALLOW GUEST TO VIEW
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
                ALLOW GUEST TO USE
              </button>
            </div>
            {!canManageGuestPermissions && (
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <LockClosedIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Only board admins and owners can change guest chat permissions.
              </p>
            )}
            {isGuest && (
              <p className="text-xs text-muted">
                You are currently a guest {callerGuestType ? `(${callerGuestType})` : ''}.
              </p>
            )}
            {permissionsError && <p className="text-xs text-danger">{permissionsError}</p>}
          </div>

          {isPermissionCheckPendingForGuest && (
            <div className="flex items-center justify-center h-24">
              <p className="text-muted text-sm">Checking guest chat access…</p>
            </div>
          )}

          {isGuestDeniedHistory && (
            <div className="flex items-center justify-center h-24">
              <p className="text-muted text-sm">Guest access does not allow viewing chat history.</p>
            </div>
          )}

          {!isPermissionCheckPendingForGuest && !isGuestDeniedHistory && state === 'loading' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted text-sm">Loading history…</p>
            </div>
          )}

          {!isPermissionCheckPendingForGuest && !isGuestDeniedHistory && state === 'empty' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted text-sm">No messages yet. Start a conversation!</p>
            </div>
          )}

          {!isPermissionCheckPendingForGuest && !isGuestDeniedHistory && state === 'error' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-500 text-sm">{error || 'Failed to load history'}</p>
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
                        <span className="text-[10px] font-bold text-white">AI</span>
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

          {/* AI typing indicator — wrapped in ul for valid HTML */}
          {aiTyping && (
            <ul className="space-y-3">
              <li className="rounded-md bg-bg-overlay p-3">
                <div className="flex gap-2 items-center">
                  <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-white">AI</span>
                  </div>
                  <div className="flex gap-1 items-center h-4">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </li>
            </ul>
          )}

          {/* AI response — wrapped in ul for valid HTML */}
          {!aiTyping && aiResponse && (
            <ul className="space-y-3">
              <li className="rounded-md bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-3">
                <div className="flex gap-2">
                  <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-white">AI</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Board AI</p>
                    <p className="text-sm text-base break-words mt-1 whitespace-pre-wrap">{aiResponse}</p>
                  </div>
                </div>
              </li>
            </ul>
          )}

          {/* Action cards — document proposals and card creations from AI */}
          {!aiTyping && actionCards.some((c) => !dismissedCards.has(c.idempotencyKey)) && (
            <>
              {commitError && (
                <p className="text-xs text-danger bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
                  {commitError}
                </p>
              )}
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
                        {isConfirmed ? '✓' : 'AI'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${
                        isConfirmed ? 'text-green-700 dark:text-green-300' : 'text-indigo-700 dark:text-indigo-300'
                      }`}>Board AI</p>
                      {card.toolName === 'propose_github_document' && card.documentPath && (
                        <div className="mt-1">
                          <p className={`text-xs font-mono ${
                            isConfirmed ? 'text-green-600 dark:text-green-400' : 'text-indigo-600 dark:text-indigo-400'
                          }`}>
                            {isConfirmed ? '✅ Committed: ' : '📄 Proposed: '}<code>{card.documentPath}</code>
                          </p>
                          {card.documentContent && !isConfirmed && (
                            <details className="mt-1">
                              <summary className="text-xs text-indigo-500 cursor-pointer hover:text-indigo-700">
                                View content ({card.documentContent.length} chars)
                              </summary>
                              <pre className="mt-1 text-xs text-base bg-bg-base rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                                {card.documentContent}
                              </pre>
                            </details>
                          )}
                          {card.commitMessage && (
                            <p className="text-xs text-muted mt-1">
                              Commit: {card.commitMessage}
                            </p>
                          )}
                          {/* Confirm / Dismiss buttons — only for suggested proposals */}
                          {!isConfirmed && (
                            <div className="flex gap-2 mt-2">
                              <button
                                type="button"
                                disabled={isCommitting}
                                onClick={() => { void handleCommitProposal(card); }}
                                className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {isCommitting ? 'Committing…' : '✓ Confirm & Commit'}
                              </button>
                              <button
                                type="button"
                                disabled={isCommitting}
                                onClick={() => handleDismissProposal(card)}
                                className="rounded-md border border-border bg-bg-base px-3 py-1.5 text-xs font-medium text-muted hover:bg-bg-overlay hover:text-subtle disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                ✕ Dismiss
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {card.toolName === 'create_board_card' && card.cardTitle && (
                        <div className="mt-1">
                          <p className="text-xs text-indigo-600 dark:text-indigo-400">
                            🃏 Created card: <strong>{card.cardTitle}</strong>
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
            </>
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
                  ? 'Checking guest chat permissions…'
                  : isGuestComposerDenied
                    ? 'Guest access does not allow sending messages.'
                    : 'Type a message…'
              }
              className="flex-1 rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-base placeholder-muted resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
            />
            <button
              disabled={composerDisabled || !composerText.trim()}
              onClick={() => { void handleSendMessage(); }}
              className="self-end rounded-md bg-primary px-3 py-2 text-xs font-semibold text-inverse hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
          {isGuestComposerDenied && (
            <p className="mt-2 text-xs text-muted">Guests are not allowed to send messages on this board.</p>
          )}
          {sendError && <p className="mt-2 text-xs text-danger">{sendError}</p>}
        </div>
      </div>
    </div>
  );
};

export default BoardChatDrawer;
