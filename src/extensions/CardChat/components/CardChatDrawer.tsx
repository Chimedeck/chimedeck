// CardChatDrawer — right-side slide-in drawer for card-scoped chat + AI Assist.
// Sprint 171: Shows message list with cursor pagination, composer input,
// refinement status badge, quality score meter, and AI response display.
// Auto-pauses session on drawer close.
import { useEffect, useState, useRef, useCallback } from 'react';
import { XMarkIcon, SparklesIcon, ArrowPathIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { apiClient } from '~/common/api/client';
import {
  createCardChatMessage,
  pauseCardChatSession,
  resumeCardChatSession,
  refineCardChat,
  type CardChatSession,
  type RefineCardChatResult,
} from '../api';
import { useCardChatHistory } from '../hooks/useCardChatHistory';
import RefinementStatusBadge from './RefinementStatusBadge';
import QualityScoreMeter from './QualityScoreMeter';

interface Props {
  cardId: string;
  session: CardChatSession;
  onClose: () => void;
  onDescriptionSave?: (description: string) => void;
}

const CardChatDrawer = ({ cardId, session, onClose, onDescriptionSave }: Props) => {
  const [composerText, setComposerText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<CardChatSession>(session);
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  // [why] Propose-description state: AI generates a description suggestion
  // from the conversation, user confirms or dismisses before applying.
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [proposedDescription, setProposedDescription] = useState<string | null>(null);
  const [applyingDescription, setApplyingDescription] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  // [why] Sync session from props when it changes externally (e.g. session resumes).
  useEffect(() => {
    setCurrentSession(session);
  }, [session]);

  const { messages, state, error } = useCardChatHistory({
    cardId,
    enabled: true,
    refreshKey,
  });

  // Scroll to latest message when new ones arrive
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // [why] Auto-pause session on drawer close to preserve resumable state.
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

  const handleSendMessage = async (): Promise<void> => {
    const trimmed = composerText.trim();
    if (!trimmed || sendingMessage || currentSession.status !== 'ACTIVE_REFINEMENT') return;

    setSendError(null);
    setSendingMessage(true);
    try {
      await createCardChatMessage({
        api: apiClient as { post: <T>(url: string, data: unknown) => Promise<T> },
        cardId,
        sessionId: currentSession.id,
        content: trimmed,
      });
      setComposerText('');
      setRefreshKey((current) => current + 1);
    } catch {
      setSendError('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  // [why] Trigger the server-side BA persona refinement loop. The server
  // runs up to 8 turns of targeted questioning and returns the latest
  // assistant message + updated session with quality score.
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
    } catch {
      setRefineError('Refinement failed. Please try again.');
    } finally {
      setRefining(false);
    }
  }, [refining, currentSession.status, currentSession.id, cardId]);

  // [why] Resume a paused/idle session back to ACTIVE_REFINEMENT so the user
  // can continue refining requirements without starting a new session.
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

  // [why] Ask the AI to synthesize the conversation into a structured
  // card description proposal. Sends a system message through the existing
  // message flow — the AI's auto-reply becomes the proposal.
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
      // [why] The server auto-generates an assistant reply. If present,
      // use it as the proposed description.
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

  // [why] Apply the confirmed description proposal to the card via
  // the parent's onDescriptionSave callback (same path as manual edits).
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

  // [why] Dismiss the proposal without applying — clears the suggestion
  // so the user can continue refining or request a new proposal.
  const handleDismissProposal = useCallback((): void => {
    setProposedDescription(null);
    setProposeError(null);
  }, []);

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
          <button
            className="text-muted hover:text-subtle transition-colors"
            onClick={handleClose}
            aria-label="Close card chat"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
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

          <div ref={historyEndRef} />

          {/* [why] Description proposal card — shown when AI generates a
               suggested card description from the conversation. Uses the
               same confirm/dismiss pattern as BoardChat's commit UI. */}
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
                  {refineError && (
                    <p className="mt-1 text-xs text-danger">{refineError}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      disabled={applyingDescription}
                      onClick={handleApplyDescription}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {applyingDescription ? 'Applying…' : '✓ Confirm & Apply'}
                    </button>
                    <button
                      type="button"
                      disabled={applyingDescription}
                      onClick={handleDismissProposal}
                      className="rounded-md border border-border bg-bg-base px-3 py-1.5 text-xs font-medium text-muted hover:bg-bg-overlay hover:text-subtle disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      ✕ Dismiss
                    </button>
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
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-40"
                onClick={() => void handleResume()}
                disabled={resuming}
              >
                {resuming ? 'Resuming…' : 'Resume'}
              </button>
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
          <div className="flex gap-2">
            {/* [why] Refine button triggers server-side BA loop — only available
                 when session is active and not currently refining. */}
            {currentSession.status === 'ACTIVE_REFINEMENT' && (
              <button
                type="button"
                className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-40 flex items-center gap-1.5"
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
            )}
            {/* [why] Propose Description button — asks AI to synthesize the
                 conversation into a structured card description. Only available
                 when session is active and has messages. */}
            {currentSession.status === 'ACTIVE_REFINEMENT' && (
              <button
                type="button"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center gap-1.5"
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
            )}
            <input
              type="text"
              className="flex-1 rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-base placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-40"
              onClick={() => void handleSendMessage()}
              disabled={!canSend || refining}
            >
              {sendingMessage ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardChatDrawer;
