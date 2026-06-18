import { useEffect, useState } from 'react';
import { apiClient } from '~/common/api/client';
import { getCardChatMessages, type CardChatMessage } from '../api';

export type HistoryState = 'loading' | 'empty' | 'error' | 'loaded';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: CardChatMessage['role'];
  content: string;
  authorId: string | null;
  authorName: string | null;
  avatar: string | null;
  createdAt: string;
}

export interface UseCardChatHistoryResult {
  messages: ChatMessage[];
  state: HistoryState;
  error: string | undefined;
  isLoading: boolean;
  isEmpty: boolean;
}

export const useCardChatHistory = ({
  cardId,
  sessionId,
  enabled = true,
  refreshKey = 0,
}: {
  cardId: string;
  sessionId?: string | undefined;
  enabled?: boolean;
  refreshKey?: number;
}): UseCardChatHistoryResult => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<HistoryState>(
    enabled && cardId && sessionId ? 'loading' : 'empty'
  );
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!enabled || !cardId || !sessionId) {
      setMessages([]);
      setState('empty');
      setError(undefined);
      return;
    }

    let cancelled = false;
    setState('loading');
    setError(undefined);

    void getCardChatMessages({
      api: apiClient as { get: <T>(url: string) => Promise<T> },
      cardId,
    })
      .then((res) => {
        if (cancelled) return;
        // [why] Filter messages to the active session so switching sessions
        // shows only the relevant conversation history.
        const sessionMessages = (res.data ?? []).filter(
          (message) => message.session_id === sessionId
        );
        const nextMessages = sessionMessages.map((message) => ({
          id: message.id,
          sessionId: message.session_id,
          role: message.role,
          content: message.content,
          authorId: message.author_id,
          authorName: message.authorName ?? null,
          avatar: message.avatar ?? null,
          createdAt: message.created_at,
        }));
        setMessages(nextMessages);
        setState(nextMessages.length > 0 ? 'loaded' : 'empty');
      })
      .catch(() => {
        if (cancelled) return;
        setMessages([]);
        setState('error');
        setError('Failed to load chat messages');
      });

    return () => {
      cancelled = true;
    };
  }, [cardId, sessionId, enabled, refreshKey]);

  return {
    messages,
    state,
    error,
    isLoading: state === 'loading',
    isEmpty: state === 'empty',
  };
};
