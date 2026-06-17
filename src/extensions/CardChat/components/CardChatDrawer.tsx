// CardChatDrawer — right-side slide-in drawer for card-scoped chat + AI Assist.
// Sprint 171: Shows message list with cursor pagination, composer input,
// refinement status badge, quality score meter, and AI response display.
// Sprint 208: Session-scoped history persistence, real-time AI progress
// streaming via WebSocket, and write-to-card action cards with confirm/dismiss.
import { useEffect, useState, useRef, useCallback } from 'react';
import { XMarkIcon, SparklesIcon, ArrowPathIcon, DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline';
import { apiClient } from '~/common/api/client';
import { socket } from '~/extensions/Realtime/client/socket';
import type { RealtimeEvent } from '~/extensions/Realtime/client/socket';
import Button from '~/common/components/Button';
import IconButton from '~/common/components/IconButton';
import {
  createCardChatMessage,
  pauseCardChatSession,
  resumeCardChatSession,
  refineCardChat,
  listCardChatSessions,
  startCardChatSession,
  requestCardChatAssist,
  commitCardChatProposal,
  type CardChatSession,
  type CardChatAssistActionCard,
} from '../api';
import { useCardChatHistory } from '../hooks/useCardChatHistory';
import RefinementStatusBadge from './RefinementStatusBadge';
import QualityScoreMeter from './QualityScoreMeter';

interface Props {
  cardId: string;
  boardId: string;
  session: CardChatSession;
  onClose: () => void;
  onDescriptionSave?: (description: string) => void;
}

const CardChatDrawer = ({ cardId, boardId, session, onClose, onDescriptionSave }: Props) => {
  const REFINE_SUGGESTION_PROMPT = 'Refine the card details and propose an updated card description based on the latest conversation.';

  // ── Session state ──────────────────────────────────────────────────────
  const [currentSession, setCurrentSession] = useState<CardChatSession>(session);
  const [sessions, setSessions] = useState<CardChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);

  // ── Composer state ─────────────────────────────────────────────────────
  const [composerText, setComposerText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // ── Message history ────────────────────────────────────────────────────
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Refinement state ───────────────────────────────────────────────────
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  // ── Resume state ───────────────────────────────────────────────────────
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  // ── Propose-description state ──────────────────────────────────────────
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [proposedDescription, setProposedDescription] = useState<string | null>(null);
  const [applyingDescription, setApplyingDescription] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // ── Sprint 208 — AI assist state ───────────────────────────────────────
  const [aiTyping, setAiTyping] = useState(false);
  const [aiProgress, setAiProgress] = useState<{
    phase: 'thinking' | 'executing_tools' | 'done';
    toolNames?: string[] | undefined;
    message?: string | undefined;
  } | null>(null);
  const [actionCards, setActionCards] = useState<CardChatAssistActionCard[]>([]);
  const [committingCards, setCommittingCards] = useState<Set<string>>(new Set());
  const [commitError, setCommitError] = useState<string | null>(null);
  const [dismissedCards, setDismissedCards] = useState<Set<string>>(new Set());

  const historyEndRef = useRef<HTMLDivElement>(null);

  // [why] Sync session from props when it changes externally (e.g. session resumes).
  useEffect(() => {
    setCurrentSession(session);
  }, [session]);

  const { messages, state, error } = useCardChatHistory({
    cardId,
    sessionId: currentSession.id,
    enabled: true,
    refreshKey,
  });

  // ── Fetch sessions on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!cardId) return;
    let cancelled = false;

    const fetchSessions = async () => {
      setSessionsLoading(true);
      try {
        const res = await listCardChatSessions({
          api: apiClient as { get: <T>(url: string) => Promise<T> },
          cardId,
        });
        if (cancelled) return;
        setSessions(res.data);
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
  }, [cardId]);

  // ── Scroll to latest message ───────────────────────────────────────────
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Close on Escape key ────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Sprint 208 — realtime AI progress subscription ────────────────────
  useEffect(() => {
    if (!boardId) return;

    const handleProgress = (event: RealtimeEvent) => {
      if (event.type !== 'card_chat.assist_progress') return;
      const payload = event.payload as {
        sessionId: string;
        cardId: string;
        phase: 'thinking' | 'executing_tools' | 'done';
        toolNames?: string[];
        message?: string;
        actionCards?: CardChatAssistActionCard[];
      } | null;
      if (!payload) return;
      // [why] Only process events for the active session to avoid cross-session bleed.
      if (payload.sessionId !== currentSession.id) return;

      if (payload.phase === 'done') {
        setAiProgress(null);
        return;
      }

      setAiProgress({
        phase: payload.phase,
        toolNames: payload.toolNames,
        message: payload.message,
      });

      // [why] Action cards arrive progressively — append them as they come.
      if (payload.actionCards && payload.actionCards.length > 0) {
        const incomingCards = payload.actionCards;
        setActionCards((prev) => {
          const existingKeys = new Set(prev.map((c) => c.idempotencyKey));
          const newCards = incomingCards.filter(
            (c) => !existingKeys.has(c.idempotencyKey),
          );
          return newCards.length > 0 ? [...prev, ...newCards] : prev;
        });
      }
    };

    const unsubscribe = socket.subscribe({ onEvent: handleProgress });
    return unsubscribe;
  }, [boardId, currentSession.id]);

  // [why] Clear progress when AI typing ends (HTTP response received).
  useEffect(() => {
    if (!aiTyping) {
      setAiProgress(null);
    }
  }, [aiTyping]);

  // ── Auto-pause session on drawer close ─────────────────────────────────
  const handleClose = () => {
    if (currentSession.status === 'ACTIVE_REFINEMENT') {
      void pauseCardChatSession({
        api: apiClient as { post: <T>(url: string, data?: unknown) => Promise<T> },
        cardId,
        sessionId: currentSession.id,
      });
    }
    onClose();
  };

  // ── Create a new session ───────────────────────────────────────────────
  const handleCreateSession = async (): Promise<void> => {
    setCreatingSession(true);
    try {
      const res = await startCardChatSession({
        api: apiClient as { post: <T>(url: string, data?: unknown) => Promise<T> },
        cardId,
      });
      setSessions((prev) => [res.data, ...prev]);
      setCurrentSession(res.data);
      setRefreshKey((k) => k + 1);
    } catch {
      // Silently fail
    } finally {
      setCreatingSession(false);
    }
  };

  // ── Switch to a different session ──────────────────────────────────────
  const handleSwitchSession = (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return;
    setCurrentSession(target);
    setRefreshKey((k) => k + 1);
    // [why] Clear action cards and AI state when switching sessions.
    setActionCards([]);
    setDismissedCards(new Set());
    setCommitError(null);
    setAiTyping(false);
    setAiProgress(null);
  };

  // ── Sprint 208 — AI assist with tool-use ───────────────────────────────
  const triggerAiAssist = async (prompt: string, sessionId: string): Promise<void> => {
    setActionCards([]);
    setDismissedCards(new Set());
    setCommitError(null);
    setAiTyping(true);
    try {
      const res = await requestCardChatAssist({
        api: apiClient as { post: <T>(url: string, data: unknown) => Promise<T> },
        cardId,
        sessionId,
        prompt,
      });
      // [why] Capture action cards (description proposals) from the AI response.
      if (res.data.actionCards && res.data.actionCards.length > 0) {
        setActionCards(res.data.actionCards);
      }
    } catch {
      setActionCards([]);
      // [why] Re-throw so handleSendMessage can fall back to simple message creation.
      throw new Error('AI assist failed');
    } finally {
      setAiTyping(false);
      setRefreshKey((current) => current + 1);
    }
  };

  // ── Send message (now uses assist endpoint) ────────────────────────────
  const handleSendMessage = async (): Promise<void> => {
    const trimmed = composerText.trim();
    if (!trimmed || sendingMessage || currentSession.status !== 'ACTIVE_REFINEMENT') return;

    setSendError(null);
    setSendingMessage(true);
    setComposerText('');
    try {
      // [why] Use the assist endpoint so the AI can call tools (e.g. write_card_description)
      // and we get real-time progress streaming. Falls back to simple message if assist fails.
      await triggerAiAssist(trimmed, currentSession.id);
    } catch {
      // [why] If assist fails, fall back to simple message creation.
      try {
        await createCardChatMessage({
          api: apiClient as { post: <T>(url: string, data: unknown) => Promise<T> },
          cardId,
          sessionId: currentSession.id,
          content: trimmed,
        });
        setRefreshKey((current) => current + 1);
      } catch {
        setSendError('Failed to send message');
      }
    } finally {
      setSendingMessage(false);
    }
  };

  // ── Refine ─────────────────────────────────────────────────────────────
  const handleRefine = useCallback(async (): Promise<void> => {
    if (refining || currentSession.status !== 'ACTIVE_REFINEMENT') return;

    setRefineError(null);
    setRefining(true);
    try {
      const result = await refineCardChat({
        api: apiClient as { post: <T>(url: string, data: unknown) => Promise<T> },
        cardId,
        sessionId: currentSession.id,
      });
      setCurrentSession(result.data.session);
      setRefreshKey((current) => current + 1);

      // [why] After refinement, generate one fresh description suggestion.
      await triggerAiAssist(REFINE_SUGGESTION_PROMPT, currentSession.id);
    } catch {
      setRefineError('Refinement failed. Please try again.');
    } finally {
      setRefining(false);
    }
  }, [refining, currentSession.status, currentSession.id, cardId]);

  // ── Resume ─────────────────────────────────────────────────────────────
  const handleResume = useCallback(async (): Promise<void> => {
    if (resuming || (currentSession.status !== 'PAUSED' && currentSession.status !== 'IDLE')) return;

    setResumeError(null);
    setResuming(true);
    try {
      const result = await resumeCardChatSession({
        api: apiClient as { post: <T>(url: string, data: unknown) => Promise<T> },
        cardId,
        sessionId: currentSession.id,
      });
      setCurrentSession(result.data);
    } catch {
      setResumeError('Failed to resume session');
    } finally {
      setResuming(false);
    }
  }, [resuming, currentSession.status, currentSession.id, cardId]);

  // ── Propose description ────────────────────────────────────────────────
  const handleProposeDescription = useCallback(async (): Promise<void> => {
    if (proposing || currentSession.status !== 'ACTIVE_REFINEMENT') return;

    setProposeError(null);
    setProposedDescription(null);
    setProposing(true);
    try {
      const result = await createCardChatMessage({
        api: apiClient as { post: <T>(url: string, data: unknown) => Promise<T> },
        cardId,
        sessionId: currentSession.id,
        content: 'PROPOSE_DESCRIPTION',
        role: 'system',
      });
      if (result.data.assistantMessage) {
        setProposedDescription(result.data.assistantMessage.content);
      } else {
        setProposeError('AI did not generate a proposal');
      }
      setRefreshKey((current) => current + 1);
    } catch {
      setProposeError('Failed to generate description proposal');
    } finally {
      setProposing(false);
    }
  }, [proposing, currentSession.status, currentSession.id, cardId]);

  // ── Apply description ──────────────────────────────────────────────────
  const handleApplyDescription = useCallback((): void => {
    if (!proposedDescription || applyingDescription || !onDescriptionSave) return;

    setApplyError(null);
    setApplyingDescription(true);
    try {
      onDescriptionSave(proposedDescription);
      setProposedDescription(null);
    } catch {
      setApplyError('Failed to apply description');
    } finally {
      setApplyingDescription(false);
    }
  }, [proposedDescription, applyingDescription, onDescriptionSave]);

  const handleDismissProposal = useCallback((): void => {
    setProposedDescription(null);
    setProposeError(null);
  }, []);

  // ── Sprint 208 — commit action card (write to card) ────────────────────
  const handleCommitActionCard = async (card: CardChatAssistActionCard): Promise<void> => {
    if (!card.descriptionContent) return;

    setCommitError(null);
    setCommittingCards((prev) => new Set(prev).add(card.idempotencyKey));

    try {
      await commitCardChatProposal({
        api: apiClient as { post: <T>(url: string, data: unknown) => Promise<T> },
        cardId,
        proposal: {
          toolCallId: card.toolCallId,
          idempotencyKey: card.idempotencyKey,
          description: card.descriptionContent,
        },
      });

      // [why] Mark as confirmed so the UI shows success state.
      setActionCards((prev) =>
        prev.map((c) =>
          c.idempotencyKey === card.idempotencyKey
            ? { ...c, state: 'confirmed' as const }
            : c,
        ),
      );

      // [why] Also notify parent so the card description updates in the modal.
      if (onDescriptionSave) {
        onDescriptionSave(card.descriptionContent);
      }
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : 'Failed to apply description');
    } finally {
      setCommittingCards((prev) => {
        const next = new Set(prev);
        next.delete(card.idempotencyKey);
        return next;
      });
    }
  };

  const handleDismissActionCard = (card: CardChatAssistActionCard): void => {
    setDismissedCards((prev) => new Set(prev).add(card.idempotencyKey));
  };

  // ── Keyboard handler ───────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const canSend = currentSession.status === 'ACTIVE_REFINEMENT' && !sendingMessage && !refining && composerText.trim().length > 0;

  return (
    // Backdrop — click to close
    <div
      className="fixed inset-0 z-[51] bg-black/50"
      onClick={handleClose}
      aria-label="Close card chat drawer"
      data-card-chat-drawer="true"
    >
      {/* Drawer panel — stop propagation so clicks inside don't close */}
      <div
        className="absolute right-0 top-0 h-full w-96 bg-bg-base border-l border-border flex flex-col shadow-2xl z-[51]"
        onClick={(e) => { e.stopPropagation(); }}
        role="dialog"
        aria-label="Card AI Assist"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-4 w-4 text-blue-500" />
            <h2 className="text-base font-semibold">AI Assist</h2>
            <RefinementStatusBadge session={currentSession} />
          </div>
          <IconButton
            aria-label="Close card chat"
            icon={<XMarkIcon className="h-5 w-5" />}
            onClick={handleClose}
          />
        </div>

        {/* Session selector bar — Sprint 208 */}
        <div className="px-4 py-2 border-b border-border bg-bg-surface flex items-center gap-2">
          <select
            value={currentSession.id}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const val = e.target.value;
              if (val === '__new__') {
                void handleCreateSession();
                return;
              }
              handleSwitchSession(val);
            }}
            className="flex-1 rounded-md border border-border bg-bg-base px-2 py-1.5 text-xs text-base focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={sessionsLoading}
          >
            {sessions.length === 0 && !sessionsLoading && (
              <option value={currentSession.id}>
                Session {currentSession.id.slice(0, 8)}
              </option>
            )}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id === currentSession.id ? '✓ ' : ''}
                Session {s.id.slice(0, 8)} — {s.last_actor_at ? new Date(s.last_actor_at).toLocaleDateString() : 'new'}
              </option>
            ))}
            <option value="__new__">+ New session</option>
          </select>

          <Button
            variant="primary"
            size="sm"
            disabled={creatingSession}
            onClick={() => { void handleCreateSession(); }}
            title="New chat session"
            className="gap-1 flex-shrink-0"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            New
          </Button>
        </div>

        {/* Quality score */}
        <div className="px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted">Quality</span>
            <div className="flex-1">
              <QualityScoreMeter score={currentSession.quality_score} />
            </div>
          </div>
        </div>

        {/* History area — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {state === 'loading' && (
            <div className="flex items-center justify-center h-24">
              <p className="text-muted text-sm">Loading messages…</p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex items-center justify-center h-24">
              <p className="text-danger text-sm">{error ?? 'Failed to load messages'}</p>
            </div>
          )}

          {state === 'empty' && (
            <div className="flex items-center justify-center h-24">
              <p className="text-muted text-sm">
                Start the conversation — describe what you want to build.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col ${message.role === 'assistant' || message.role === 'system'
                ? 'items-start'
                : 'items-end'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  message.role === 'assistant' || message.role === 'system'
                    ? 'bg-bg-overlay text-base'
                    : 'bg-blue-600 text-white'
                }`}
              >
                <span className="whitespace-pre-wrap break-words">{message.content}</span>
              </div>
              {(message.authorName || message.role) && (
                <span className="mt-1 text-[10px] text-muted px-1">
                  {message.role === 'assistant' ? 'AI' : message.authorName ?? message.role}
                </span>
              )}
            </div>
          ))}

          {/* Sprint 208 — AI typing / progress indicator */}
          {aiTyping && (
            <div className="rounded-md bg-bg-overlay p-3">
              <div className="flex gap-2 items-start">
                <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-white">AI</span>
                </div>
                <div className="flex-1 min-w-0">
                  {aiProgress ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                        {aiProgress.phase === 'thinking' && 'Thinking…'}
                        {aiProgress.phase === 'executing_tools' && (
                          aiProgress.toolNames && aiProgress.toolNames.length > 0
                            ? `Running: ${aiProgress.toolNames.map((n) => n.replaceAll('_', ' ')).join(', ')}`
                            : 'Executing tools…'
                        )}
                      </p>
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
            </div>
          )}

          {/* Sprint 208 — commit error */}
          {!aiTyping && commitError && (
            <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-white">!</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300">Commit Error</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{commitError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Sprint 208 — Action cards (write-to-card proposals) */}
          {!aiTyping && actionCards.some((c) => !dismissedCards.has(c.idempotencyKey)) && (
            <div className="space-y-3">
              {actionCards
                .filter((c) => !dismissedCards.has(c.idempotencyKey))
                .map((card) => {
                  const isCommitting = committingCards.has(card.idempotencyKey);
                  const isConfirmed = card.state === 'confirmed';
                  return (
                    <div
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
                          }`}>Card AI</p>
                          {card.toolName === 'write_card_description' && card.descriptionContent && (
                            <div className="mt-1">
                              <p className={`text-xs ${
                                isConfirmed ? 'text-green-600 dark:text-green-400' : 'text-indigo-600 dark:text-indigo-400'
                              }`}>
                                {isConfirmed ? '✅ Applied: ' : '📝 Proposed: '}
                                {card.descriptionPreview ?? 'Description update'}
                              </p>
                              {!isConfirmed && (
                                <details className="mt-1">
                                  <summary className="text-xs text-indigo-500 cursor-pointer hover:text-indigo-700">
                                    View proposed description
                                  </summary>
                                  <pre className="mt-1 text-xs text-base bg-bg-base rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                                    {card.descriptionContent}
                                  </pre>
                                </details>
                              )}
                              {!isConfirmed && (
                                <div className="flex gap-2 mt-2">
                                  <Button
                                    variant="success"
                                    size="sm"
                                    disabled={isCommitting}
                                    onClick={() => { void handleCommitActionCard(card); }}
                                  >
                                    {isCommitting ? 'Committing…' : '✓ Confirm & Commit'}
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={isCommitting}
                                    onClick={() => handleDismissActionCard(card)}
                                  >
                                    ✕ Dismiss
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          <div ref={historyEndRef} />

          {/* Description proposal card (legacy Propose button flow) */}
          {proposedDescription && (
            <div className="rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-3">
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <DocumentTextIcon className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    AI Description Proposal
                  </p>
                  <details className="mt-1" open>
                    <summary className="text-xs text-indigo-500 cursor-pointer hover:text-indigo-700">
                      View proposed description
                    </summary>
                    <pre className="mt-1 text-xs text-base bg-bg-base rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {proposedDescription}
                    </pre>
                  </details>
                  {applyError && (
                    <p className="mt-1 text-xs text-danger">{applyError}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="success"
                      size="sm"
                      disabled={applyingDescription}
                      onClick={handleApplyDescription}
                    >
                      {applyingDescription ? 'Applying…' : '✓ Confirm & Apply'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={applyingDescription}
                      onClick={handleDismissProposal}
                    >
                      ✕ Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Composer — sticky bottom */}
        <div className="px-4 py-3 border-t border-border bg-bg-surface/50">
          {(currentSession.status === 'PAUSED' || currentSession.status === 'IDLE') && (
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs text-amber-600 dark:text-amber-400 flex-1">
                {currentSession.status === 'IDLE'
                  ? 'Session is idle. Resume to continue.'
                  : 'Session is paused.'}
              </p>
              {resumeError && (
                <p className="text-xs text-danger">{resumeError}</p>
              )}
              <Button
                variant="primary"
                size="sm"
                className="flex-shrink-0"
                onClick={() => void handleResume()}
                disabled={resuming}
              >
                {resuming ? 'Resuming…' : 'Resume'}
              </Button>
            </div>
          )}
          {currentSession.status === 'READY_FOR_REVIEW' && (
            <p className="mb-2 text-xs text-green-600 dark:text-green-400">
              Requirements are ready for review.
            </p>
          )}
          {sendError && (
            <p className="mb-2 text-xs text-danger">{sendError}</p>
          )}
          {refineError && (
            <p className="mb-2 text-xs text-danger">{refineError}</p>
          )}
          {proposeError && (
            <p className="mb-2 text-xs text-danger">{proposeError}</p>
          )}
          <div className="space-y-2">
            {currentSession.status === 'ACTIVE_REFINEMENT' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0"
                  onClick={() => void handleRefine()}
                  disabled={refining}
                  aria-label="Refine with AI"
                >
                  {refining ? (
                    <>
                      <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                      Refining…
                    </>
                  ) : (
                    'Refine'
                  )}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0"
                  onClick={() => void handleProposeDescription()}
                  disabled={proposing || refining}
                  aria-label="Propose card description from chat"
                >
                  {proposing ? (
                    <>
                      <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                      Proposing…
                    </>
                  ) : (
                    <>
                      <DocumentTextIcon className="h-3.5 w-3.5" />
                      Propose
                    </>
                  )}
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="flex-1 min-w-0 rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-base placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                placeholder={
                  currentSession.status === 'ACTIVE_REFINEMENT'
                    ? 'Describe what you want to build…'
                    : 'Session is not active'
                }
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={currentSession.status !== 'ACTIVE_REFINEMENT' || sendingMessage || refining}
              />
              <Button
                variant="primary"
                size="sm"
                className="flex-shrink-0"
                onClick={() => void handleSendMessage()}
                disabled={!canSend || refining}
              >
                {sendingMessage ? '…' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardChatDrawer;
