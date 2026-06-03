// BoardChatDrawer — right-side slide-in drawer for board chat history and composition.
// Sprint 164: Shows loading/empty/error states; sticky composer footer shell.
// Sprint 165: Wires real history endpoint and message send.

import { useEffect, useState, useRef } from 'react';
import { useBoardChatHistory } from '../hooks/useBoardChatHistory';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface Props {
  boardId: string;
  onClose: () => void;
}

const BoardChatDrawer = ({ boardId, onClose }: Props) => {
  const { messages, state, error } = useBoardChatHistory({ boardId, enabled: !!boardId });
  const [composerText, setComposerText] = useState('');
  const historyEndRef = useRef<HTMLDivElement>(null);

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
          {state === 'loading' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted text-sm">Loading history…</p>
            </div>
          )}

          {state === 'empty' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted text-sm">No messages yet. Start a conversation!</p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-500 text-sm">{error || 'Failed to load history'}</p>
            </div>
          )}

          {state === 'loaded' && messages.length > 0 && (
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

          {/* Scroll anchor */}
          <div ref={historyEndRef} />
        </div>

        {/* Sticky composer footer */}
        <div className="border-t border-border bg-bg-surface px-4 py-3 flex-shrink-0">
          <div className="flex gap-2">
            <textarea
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-base placeholder-muted resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
            />
            <button
              disabled={!composerText.trim()}
              className="self-end rounded-md bg-primary px-3 py-2 text-xs font-semibold text-inverse hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoardChatDrawer;
