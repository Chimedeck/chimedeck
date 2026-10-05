import { useEffect, useState } from 'react';
import { apiClient } from '~/common/api/client';
import { getBoardChatMessages } from '../api';

export type HistoryState = 'loading' | 'empty' | 'error' | 'loaded';

export interface ChatMessage {
  id: string;
  userId: string | null;
  userName: string;
  text: string;
  createdAt: string;
  avatar?: string;
  isAssistant: boolean;
}

export interface UseBoardChatHistoryResult {
  messages: ChatMessage[];
  state: HistoryState;
  error?: string;
  isLoading: boolean;
  isEmpty: boolean;
}

export const useBoardChatHistory = ({
  boardId,
  sessionId,
  enabled = true,
  refreshKey = 0,
}: {
  boardId: string;
  sessionId?: string | undefined;
  enabled?: boolean;
  refreshKey?: number;
}): UseBoardChatHistoryResult => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<HistoryState>(
    enabled && boardId && sessionId ? 'loading' : 'empty'
  );
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!enabled || !boardId || !sessionId) {
      setMessages([]);
      setState('empty');
      setError(undefined);
      return;
    }

    let cancelled = false;
    setState('loading');
    setError(undefined);

    void getBoardChatMessages({
      api: apiClient as { get: <T>(url: string) => Promise<T> },
      boardId,
      sessionId,
    })
      .then((res) => {
        if (cancelled) return;
        const nextMessages = res.data.map((message) => ({
          id: message.id,
          userId: message.author_id,
          userName: message.userName,
          text: message.content,
          createdAt: message.created_at,
          avatar: message.avatar ?? undefined,
          isAssistant: message.is_assistant,
        }));
        setMessages(nextMessages);
        setState(nextMessages.length > 0 ? 'loaded' : 'empty');
      })
      .catch(() => {
        if (cancelled) return;
        setMessages([]);
        setState('error');
        setError('Failed to load history');
      });

    return () => {
      cancelled = true;
    };
  }, [boardId, sessionId, enabled, refreshKey]);

  return {
    messages,
    state,
    error,
    isLoading: state === 'loading',
    isEmpty: state === 'empty',
  };
};
