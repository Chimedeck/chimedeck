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
  type BoardChatPermissions,
} from '../api';
import type { GuestType } from '~/extensions/Board/mods/guestPermissions';

interface Props {
  boardId: string;
  isGuest?: boolean;
  callerGuestType?: GuestType | null;
  canManageGuestPermissions?: boolean;
  onClose: () => void;
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
    setAiTyping(true);
    try {
      const res = await requestBoardChatAssist({
        api: apiClient as { post: <T>(url: string, data: unknown) => Promise<T> },
        boardId,
        prompt,
      });
      setAiResponse(res.data.message ?? null);
    } catch {
      setAiResponse(null);
    } finally {
      setAiTyping(false);
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
                <li key={msg.id} className="rounded-md bg-bg-overlay p-3">
                  <div className="flex gap-2">
                    {msg.avatar && (
                      <img
                        src={msg.avatar}
                        alt={msg.userName}
                        className="h-6 w-6 rounded-full flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-base">{msg.userName}</p>
                      <p className="text-xs text-muted">{new Date(msg.createdAt).toLocaleTimeString()}</p>
                      <p className="text-sm text-base break-words mt-1">{msg.text}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* AI typing indicator */}
          {aiTyping && (
            <li className="rounded-md bg-bg-overlay p-3 list-none">
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
          )}

          {/* AI response */}
          {!aiTyping && aiResponse && (
            <li className="rounded-md bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-3 list-none">
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
