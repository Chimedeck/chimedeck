// useBoardChatHistory — stub hook to query board chat message history.
// Sprint 165 will integrate the backend API; for now, this stubs loading/empty/error states.

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
}: {
  boardId: string;
  enabled?: boolean;
}): UseBoardChatHistoryResult => {
  // [why] Stub implementation: Sprint 165 will wire the actual API endpoint.
  // For now, return a predictable "loading" state that UI layers can consume.
  if (!enabled || !boardId) {
    return {
      messages: [],
      state: 'empty',
      isLoading: false,
      isEmpty: true,
    };
  }

  // [why] Always return loading for now so the drawer UI tests the loading state properly.
  return {
    messages: [],
    state: 'loading',
    isLoading: true,
    isEmpty: false,
  };
};
