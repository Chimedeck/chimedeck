import { useEffect, useState } from 'react';
import { apiClient } from '~/common/api/client';
import { getBoardChatMessages } from '../api';

export type HistoryState = 'loading' | 'empty' | 'error' | 'loaded';

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  avatar?: string;
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
  enabled = true,
  refreshKey = 0,
}: {
  boardId: string;
  enabled?: boolean;
  refreshKey?: number;
}): UseBoardChatHistoryResult => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<HistoryState>(enabled && boardId ? 'loading' : 'empty');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!enabled || !boardId) {
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
  }, [boardId, enabled, refreshKey]);

  return {
    messages,
    state,
    error,
    isLoading: state === 'loading',
    isEmpty: state === 'empty',
  };
};
