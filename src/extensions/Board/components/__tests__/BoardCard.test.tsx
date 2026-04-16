import { describe, expect, it, mock } from 'bun:test';
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
    const onClick = mock();

    const tree = BoardCard({
      board: baseBoard,
      onClick,
      onArchive: mock(),
      onDelete: mock(),
      onDuplicate: mock(),
    }) as ReactElement;

    expect(tree.props.role).toBe('link');
    expect(tree.props.tabIndex).toBe(0);
    expect(tree.props['aria-label']).toBe('Open board Bug Board');

    const enterEvent = { key: 'Enter', preventDefault: mock() };
    const spaceEvent = { key: ' ', preventDefault: mock() };

    tree.props.onKeyDown(enterEvent);
    tree.props.onKeyDown(spaceEvent);

    expect(enterEvent.preventDefault).toHaveBeenCalled();
    expect(spaceEvent.preventDefault).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
