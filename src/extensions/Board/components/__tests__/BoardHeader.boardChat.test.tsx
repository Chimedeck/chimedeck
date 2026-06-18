// BoardHeader.boardChat.test.tsx — visibility matrix for board chat button
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BoardHeader from '../BoardHeader';
import type { Board } from '../../api';

describe('BoardHeader — Board Chat button visibility', () => {
  const mockBoard: Board = {
    id: 'board-1',
    title: 'Test Board',
    state: 'ACTIVE',
    isStarred: false,
    workspaceId: 'ws-1',
  } as Board;

  const mockHandlers = {
    onTitleSave: vi.fn().mockResolvedValue(undefined),
    onOpenMembers: vi.fn(),
  };

  it('shows chat button for non-guest members when onOpenBoardChat is provided', () => {
    render(
      <BoardHeader board={mockBoard} isGuest={false} onOpenBoardChat={vi.fn()} {...mockHandlers} />
    );

    const chatButton = screen.getByLabelText('Board chat');
    expect(chatButton).toBeInTheDocument();
  });

  it('hides chat button for guests regardless of handler', () => {
    render(
      <BoardHeader board={mockBoard} isGuest={true} onOpenBoardChat={vi.fn()} {...mockHandlers} />
    );

    const chatButton = screen.queryByLabelText('Board chat');
    expect(chatButton).not.toBeInTheDocument();
  });

  it('hides chat button when onOpenBoardChat is not provided', () => {
    render(
      <BoardHeader
        board={mockBoard}
        isGuest={false}
        onOpenBoardChat={undefined}
        {...mockHandlers}
      />
    );

    const chatButton = screen.queryByLabelText('Board chat');
    expect(chatButton).not.toBeInTheDocument();
  });

  it('calls onOpenBoardChat when button is clicked', () => {
    const onOpenBoardChat = vi.fn();
    const { getByLabelText } = render(
      <BoardHeader
        board={mockBoard}
        isGuest={false}
        onOpenBoardChat={onOpenBoardChat}
        {...mockHandlers}
      />
    );

    const chatButton = getByLabelText('Board chat');
    chatButton.click();

    expect(onOpenBoardChat).toHaveBeenCalledTimes(1);
  });

  it('applies background styling when hasBackground is true', () => {
    const { getByLabelText } = render(
      <BoardHeader
        board={mockBoard}
        isGuest={false}
        hasBackground={true}
        onOpenBoardChat={vi.fn()}
        {...mockHandlers}
      />
    );

    const chatButton = getByLabelText('Board chat');
    expect(chatButton.className).toContain('text-white/90');
  });

  it('applies standard styling when hasBackground is false', () => {
    const { getByLabelText } = render(
      <BoardHeader
        board={mockBoard}
        isGuest={false}
        hasBackground={false}
        onOpenBoardChat={vi.fn()}
        {...mockHandlers}
      />
    );

    const chatButton = getByLabelText('Board chat');
    expect(chatButton.className).toContain('text-muted');
  });
});
