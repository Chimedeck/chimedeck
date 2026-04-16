import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import BoardCard from '../BoardCard';
import type { Board } from '../../api';

const baseBoard: Board = {
  id: 'board-1',
  workspaceId: 'ws-1',
  title: 'Bug Board',
  state: 'ACTIVE',
  visibility: 'PRIVATE',
  createdAt: new Date().toISOString(),
  isStarred: false,
  background: null,
  callerGuestType: null,
};

describe('BoardCard', () => {
  it('exposes a keyboard-focusable control for opening the board', () => {
    const onClick = vi.fn();

    const tree = BoardCard({
      board: baseBoard,
      onClick,
      onArchive: vi.fn(),
      onDelete: vi.fn(),
      onDuplicate: vi.fn(),
    }) as ReactElement;

    expect(tree.props.role).toBe('link');
    expect(tree.props.tabIndex).toBe(0);
    expect(tree.props['aria-label']).toBe('Open board Bug Board');

    const enterEvent = { key: 'Enter', preventDefault: vi.fn() };
    const spaceEvent = { key: ' ', preventDefault: vi.fn() };

    tree.props.onKeyDown(enterEvent);
    tree.props.onKeyDown(spaceEvent);

    expect(enterEvent.preventDefault).toHaveBeenCalled();
    expect(spaceEvent.preventDefault).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
