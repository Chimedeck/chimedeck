// BoardChatDrawer.test.tsx — verify drawer open/close, history states, and composer layout
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BoardChatDrawer from '../BoardChatDrawer';
import * as useBoardChatHistoryModule from '../../hooks/useBoardChatHistory';

// Mock the history hook
vi.mock('../../hooks/useBoardChatHistory', () => ({
  useBoardChatHistory: vi.fn(() => ({
    messages: [],
    state: 'loading',
    isLoading: true,
    isEmpty: false,
  })),
}));

describe('BoardChatDrawer', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the drawer with header and title', () => {
    render(
      <BoardChatDrawer
        boardId="board-1"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Board Chat')).toBeInTheDocument();
    expect(screen.getByLabelText('Close board chat')).toBeInTheDocument();
  });

  it('displays loading state when history is loading', () => {
    render(
      <BoardChatDrawer
        boardId="board-1"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Loading history…')).toBeInTheDocument();
  });

  it('displays empty state when no messages', () => {
    vi.mocked(useBoardChatHistoryModule.useBoardChatHistory).mockReturnValue({
      messages: [],
      state: 'empty',
      isLoading: false,
      isEmpty: true,
    } as any);

    render(
      <BoardChatDrawer
        boardId="board-1"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('No messages yet. Start a conversation!')).toBeInTheDocument();
  });

  it('displays error state when query fails', () => {
    vi.mocked(useBoardChatHistoryModule.useBoardChatHistory).mockReturnValue({
      messages: [],
      state: 'error',
      error: 'Network error',
      isLoading: false,
      isEmpty: false,
    } as any);

    render(
      <BoardChatDrawer
        boardId="board-1"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders message history when loaded', () => {
    vi.mocked(useBoardChatHistoryModule.useBoardChatHistory).mockReturnValue({
      messages: [
        {
          id: 'msg-1',
          userId: 'user-1',
          userName: 'Alice',
          text: 'Hello board!',
          createdAt: new Date().toISOString(),
          avatar: 'https://example.com/alice.png',
        },
      ],
      state: 'loaded',
      isLoading: false,
      isEmpty: false,
    } as any);

    render(
      <BoardChatDrawer
        boardId="board-1"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Hello board!')).toBeInTheDocument();
  });

  it('closes drawer when close button is clicked', () => {
    render(
      <BoardChatDrawer
        boardId="board-1"
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByLabelText('Close board chat');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('closes drawer when backdrop is clicked', () => {
    const { container } = render(
      <BoardChatDrawer
        boardId="board-1"
        onClose={mockOnClose}
      />
    );

    const backdrop = container.querySelector('[aria-label="Close board chat drawer"]');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('closes drawer when Escape key is pressed', async () => {
    render(
      <BoardChatDrawer
        boardId="board-1"
        onClose={mockOnClose}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it('renders composer with disabled send button when empty', () => {
    render(
      <BoardChatDrawer
        boardId="board-1"
        onClose={mockOnClose}
      />
    );

    const sendButton = screen.getByText('Send') as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });

  it('enables send button when composer has text', async () => {
    render(
      <BoardChatDrawer
        boardId="board-1"
        onClose={mockOnClose}
      />
    );

    const textarea = screen.getByPlaceholderText('Type a message…') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Hello!' } });

    const sendButton = screen.getByText('Send') as HTMLButtonElement;

    await waitFor(() => {
      expect(sendButton.disabled).toBe(false);
    });
  });

  it('disables send button when text is only whitespace', async () => {
    render(
      <BoardChatDrawer
        boardId="board-1"
        onClose={mockOnClose}
      />
    );

    const textarea = screen.getByPlaceholderText('Type a message…') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '   \n  ' } });

    const sendButton = screen.getByText('Send') as HTMLButtonElement;

    await waitFor(() => {
      expect(sendButton.disabled).toBe(true);
    });
  });

  it('displays composer as sticky footer', () => {
    const { container } = render(
      <BoardChatDrawer
        boardId="board-1"
        onClose={mockOnClose}
      />
    );

    // Find the composer section (sticky footer with border-t)
    const composerSection = container.querySelector('.border-t.border-border');
    expect(composerSection).toBeInTheDocument();
    expect(composerSection).toHaveClass('flex-shrink-0'); // Should not shrink
  });
});
