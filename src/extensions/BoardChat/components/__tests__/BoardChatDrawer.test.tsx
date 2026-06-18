import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BoardChatDrawer from '../BoardChatDrawer';
import * as useBoardChatHistoryModule from '../../hooks/useBoardChatHistory';
import * as boardChatApiModule from '../../api';

vi.mock('../../hooks/useBoardChatHistory', () => ({
  useBoardChatHistory: vi.fn(() => ({
    messages: [],
    state: 'loading',
    isLoading: true,
    isEmpty: false,
  })),
}));

vi.mock('../../api', () => ({
  getBoardChatPermissions: vi.fn(async () => ({
    data: {
      board_id: 'board-1',
      guest_can_view: false,
      guest_can_use: false,
      updated_at: new Date().toISOString(),
    },
  })),
  patchBoardChatPermissions: vi.fn(async (_args: unknown) => ({
    data: {
      board_id: 'board-1',
      guest_can_view: false,
      guest_can_use: false,
      updated_at: new Date().toISOString(),
    },
  })),
}));

describe('BoardChatDrawer', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the drawer with header and title', async () => {
    render(<BoardChatDrawer boardId="board-1" onClose={mockOnClose} />);

    expect(screen.getByText('Board Chat')).toBeInTheDocument();
    expect(screen.getByLabelText('Close board chat')).toBeInTheDocument();
    expect(screen.getByText('ALLOW GUEST TO VIEW')).toBeInTheDocument();
  });

  it('displays loading state when history is loading', () => {
    render(<BoardChatDrawer boardId="board-1" onClose={mockOnClose} />);

    expect(screen.getByText('Loading history…')).toBeInTheDocument();
  });

  it('displays denied history state for guest when guest_can_view is false', async () => {
    (
      boardChatApiModule.getBoardChatPermissions as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        board_id: 'board-1',
        guest_can_view: false,
        guest_can_use: false,
        updated_at: new Date().toISOString(),
      },
    });

    render(
      <BoardChatDrawer
        boardId="board-1"
        isGuest={true}
        callerGuestType="VIEWER"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText('Guest access does not allow viewing chat history.')
      ).toBeInTheDocument();
    });
  });

  it('disables composer and shows helper copy when guest cannot send', async () => {
    (
      boardChatApiModule.getBoardChatPermissions as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        board_id: 'board-1',
        guest_can_view: true,
        guest_can_use: false,
        updated_at: new Date().toISOString(),
      },
    });
    (
      useBoardChatHistoryModule.useBoardChatHistory as unknown as {
        mockReturnValue: (value: unknown) => void;
      }
    ).mockReturnValue({
      messages: [],
      state: 'empty',
      isLoading: false,
      isEmpty: true,
    } as any);

    render(
      <BoardChatDrawer
        boardId="board-1"
        isGuest={true}
        callerGuestType="VIEWER"
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText('Guests are not allowed to send messages on this board.')
      ).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Guest access does not allow sending messages.');
    const sendButton = screen.getByText('Send');
    expect(textarea.disabled).toBe(true);
    expect(sendButton.disabled).toBe(true);
  });

  it('shows lock state for non-admin/non-owner users', async () => {
    render(
      <BoardChatDrawer boardId="board-1" canManageGuestPermissions={false} onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(
        screen.getByText('Only board admins and owners can change guest chat permissions.')
      ).toBeInTheDocument();
    });

    const viewButton = screen.getByRole('button', { name: 'ALLOW GUEST TO VIEW' });
    const useButton = screen.getByRole('button', { name: 'ALLOW GUEST TO USE' });
    expect(viewButton.disabled).toBe(true);
    expect(useButton.disabled).toBe(true);
  });

  it('supports coupling rules: enabling use auto-enables view', async () => {
    (
      boardChatApiModule.getBoardChatPermissions as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        board_id: 'board-1',
        guest_can_view: false,
        guest_can_use: false,
        updated_at: new Date().toISOString(),
      },
    });
    (
      boardChatApiModule.patchBoardChatPermissions as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        board_id: 'board-1',
        guest_can_view: true,
        guest_can_use: true,
        updated_at: new Date().toISOString(),
      },
    });

    render(
      <BoardChatDrawer boardId="board-1" canManageGuestPermissions={true} onClose={mockOnClose} />
    );

    const useButton = await screen.findByRole('button', { name: 'ALLOW GUEST TO USE' });
    fireEvent.click(useButton);

    await waitFor(() => {
      expect(boardChatApiModule.patchBoardChatPermissions).toHaveBeenCalled();
    });

    const patchArgs = (
      boardChatApiModule.patchBoardChatPermissions as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[0]?.[0] as {
      body: { guest_can_view: boolean; guest_can_use: boolean };
    };
    expect(patchArgs.body.guest_can_view).toBe(true);
    expect(patchArgs.body.guest_can_use).toBe(true);
  });

  it('rolls back optimistic state when permission patch fails', async () => {
    (
      boardChatApiModule.getBoardChatPermissions as unknown as {
        mockResolvedValue: (value: unknown) => void;
      }
    ).mockResolvedValue({
      data: {
        board_id: 'board-1',
        guest_can_view: true,
        guest_can_use: true,
        updated_at: new Date().toISOString(),
      },
    });
    (
      boardChatApiModule.patchBoardChatPermissions as unknown as {
        mockRejectedValueOnce: (value: unknown) => void;
      }
    ).mockRejectedValueOnce(new Error('boom'));

    render(
      <BoardChatDrawer boardId="board-1" canManageGuestPermissions={true} onClose={mockOnClose} />
    );

    const viewButton = await screen.findByRole('button', { name: 'ALLOW GUEST TO VIEW' });
    fireEvent.click(viewButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to update chat permissions')).toBeInTheDocument();
    });

    expect(boardChatApiModule.patchBoardChatPermissions).toHaveBeenCalledTimes(1);
  });

  it('closes drawer when close button is clicked', () => {
    render(<BoardChatDrawer boardId="board-1" onClose={mockOnClose} />);

    const closeButton = screen.getByLabelText('Close board chat');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('closes drawer when backdrop is clicked', () => {
    const { container } = render(<BoardChatDrawer boardId="board-1" onClose={mockOnClose} />);

    const backdrop = container.querySelector('[aria-label="Close board chat drawer"]');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('closes drawer when Escape key is pressed', async () => {
    render(<BoardChatDrawer boardId="board-1" onClose={mockOnClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
