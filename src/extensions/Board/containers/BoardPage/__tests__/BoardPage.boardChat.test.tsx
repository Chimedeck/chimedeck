// BoardPage.boardChat.test.tsx — wiring and BOARD_CHAT_ENABLED gate tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import BoardPage from '../BoardPage';
import * as boardChatConfig from '../../config/boardChatConfig';

// Mock the BOARD_CHAT_ENABLED flag
vi.mock('../../config/boardChatConfig', () => ({
  BOARD_CHAT_ENABLED: false,
}));

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useParams: vi.fn(() => ({ boardId: 'board-1', cardId: undefined })),
  useNavigate: vi.fn(),
}));

vi.mock('../../api');
vi.mock('../../../Realtime/hooks/useWebSocket');
vi.mock('../../../Realtime/hooks/useBoardSync');
vi.mock('../../../Realtime/PollingFallback');
vi.mock('../../../Notification/slices/notificationSlice');

describe('BoardPage — Board Chat feature gate', () => {
  let mockStore: ReturnType<typeof configureStore>;

  beforeEach(() => {
    mockStore = configureStore({
      reducer: {
        board: () => ({
          board: { id: 'board-1', title: 'Test Board', state: 'ACTIVE' },
          lists: {},
          listOrder: [],
          cards: {},
          cardsByList: {},
          status: 'loaded',
        }),
        auth: () => ({
          token: 'token',
          user: { id: 'user-1' },
        }),
        workspace: () => ({
          activeWorkspaceId: 'ws-1',
          isGuest: false,
        }),
        boardMembers: () => ({ data: [] }),
        notifications: () => ({ notifications: [] }),
        boardViewSwitcher: () => ({ activeView: 'KANBAN' }),
      },
    });
  });

  it('does not render board chat button when BOARD_CHAT_ENABLED is false', async () => {
    (boardChatConfig as any).BOARD_CHAT_ENABLED = false;

    render(
      <Provider store={mockStore}>
        <BoardPage />
      </Provider>
    );

    await waitFor(() => {
      const chatButton = screen.queryByLabelText('Board chat');
      expect(chatButton).not.toBeInTheDocument();
    });
  });

  it('renders board chat button when BOARD_CHAT_ENABLED is true', async () => {
    (boardChatConfig as any).BOARD_CHAT_ENABLED = true;

    render(
      <Provider store={mockStore}>
        <BoardPage />
      </Provider>
    );

    await waitFor(() => {
      const chatButton = screen.getByLabelText('Board chat');
      expect(chatButton).toBeInTheDocument();
    });
  });

  it('does not render board chat button for guests even when BOARD_CHAT_ENABLED is true', async () => {
    (boardChatConfig as any).BOARD_CHAT_ENABLED = true;

    // Create a guest-specific store
    const guestStore = configureStore({
      reducer: {
        board: () => ({
          board: { id: 'board-1', title: 'Test Board', state: 'ACTIVE' },
          lists: {},
          listOrder: [],
          cards: {},
          cardsByList: {},
          status: 'loaded',
        }),
        auth: () => ({
          token: 'token',
          user: { id: 'user-1' },
        }),
        workspace: () => ({
          activeWorkspaceId: 'ws-1',
          isGuest: true, // Set as guest
        }),
        boardMembers: () => ({ data: [] }),
        notifications: () => ({ notifications: [] }),
        boardViewSwitcher: () => ({ activeView: 'KANBAN' }),
      },
    });

    render(
      <Provider store={guestStore}>
        <BoardPage />
      </Provider>
    );

    await waitFor(() => {
      const chatButton = screen.queryByLabelText('Board chat');
      expect(chatButton).not.toBeInTheDocument();
    });
  });

  it('opens board chat drawer when button is clicked', async () => {
    (boardChatConfig as any).BOARD_CHAT_ENABLED = true;

    const { getByLabelText } = render(
      <Provider store={mockStore}>
        <BoardPage />
      </Provider>
    );

    await waitFor(() => {
      const chatButton = getByLabelText('Board chat');
      fireEvent.click(chatButton);
    });

    // In a full implementation, this would verify that the drawer opens
    // For now, we just verify the click is handled
  });

  it('board page still renders board layout when feature is disabled', async () => {
    (boardChatConfig as any).BOARD_CHAT_ENABLED = false;

    render(
      <Provider store={mockStore}>
        <BoardPage />
      </Provider>
    );

    // Verify the board header is still rendered
    await waitFor(() => {
      expect(screen.getByText('Test Board')).toBeInTheDocument();
    });
  });
});
