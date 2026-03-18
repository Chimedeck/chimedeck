// src/extensions/Board/realtime.ts
// Workspace-level realtime subscription for the boards list page.
//
// Connects the singleton WebSocket on the personal user channel (no board room)
// and dispatches board_deleted events so the boards list removes the board for
// all connected users without requiring a page reload.
//
// [why] The server fans board_deleted events out to every workspace member's
// personal WS channel via publishToUser, so any authenticated socket connection
// — even without a board subscription — will receive the event.
import { useEffect } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { socket } from '../Realtime/client/socket';
import type { RealtimeEvent } from '../Realtime/client/socket';
import { boardRemovedByRealtime } from './containers/BoardListPage/BoardListPage.duck';

export interface UseWorkspaceSyncOptions {
  workspaceId: string;
  token: string;
}

// useWorkspaceSync subscribes to workspace-scoped realtime events on the boards
// list page. When a board_deleted event arrives for this workspace, the board is
// removed from Redux state immediately for all connected users.
export function useWorkspaceSync({ workspaceId, token }: UseWorkspaceSyncOptions): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!token || !workspaceId) return;

    const handleEvent = (event: RealtimeEvent) => {
      if (event.type !== 'board_deleted') return;
      const payload = event.payload as { boardId: string; workspaceId: string } | undefined;
      if (!payload) return;
      // Filter to only remove boards that belong to the workspace currently viewed.
      if (payload.workspaceId === workspaceId) {
        dispatch(boardRemovedByRealtime({ boardId: payload.boardId }));
      }
    };

    const unsubscribe = socket.subscribe({ onEvent: handleEvent });

    // Connect without a board room subscription — the server registers this socket
    // in the user's personal channel on authenticate, so publishToUser events arrive.
    socket.connect({ token });

    return () => {
      unsubscribe();
      socket.disconnect();
    };
    // Reconnect when workspace or token changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, token]);
}
