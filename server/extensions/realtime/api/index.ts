// server/extensions/realtime/api/index.ts
// WebSocket upgrade handler and message dispatcher for real-time board subscriptions.
import type { ServerWebSocket } from 'bun';
import type { Server } from 'bun';
import { verifyWsToken } from '../mods/auth';
import { rooms, type WsData } from '../mods/rooms/index';
import { subscribeToBoard } from '../mods/rooms/subscribe';
import { unsubscribeFromBoard } from '../mods/rooms/unsubscribe';
import { recordPong, initHeartbeat, startHeartbeatLoop } from '../mods/heartbeat';
import { cache } from '../../../mods/cache/index';
import { db } from '../../../common/db';

const allSockets = new Set<ServerWebSocket<WsData>>();

startHeartbeatLoop(() => allSockets);

export async function handleWsUpgrade(req: Request, server: Server): Promise<boolean> {
  const url = new URL(req.url);
  if (url.pathname !== '/ws') return false;

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return false;

  const auth = await verifyWsToken(token);
  if (!auth) return false;

  const upgraded = server.upgrade(req, {
    data: {
      userId: auth.userId,
      token: auth.token,
      subscribedBoards: new Set<string>(),
    } as WsData,
  });

  return upgraded;
}

export const wsHandlers = {
  open(ws: ServerWebSocket<WsData>): void {
    allSockets.add(ws);
    initHeartbeat(ws);
  },

  async message(ws: ServerWebSocket<WsData>, raw: string | Buffer): Promise<void> {
    let msg: { type: string; board_id?: string };
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', name: 'invalid-json' }));
      return;
    }

    if (msg.type === 'ping') {
      const auth = await verifyWsToken(ws.data.token);
      if (!auth) {
        ws.send(JSON.stringify({ type: 'session_expired' }));
        ws.close(4001, 'session expired');
        return;
      }
      recordPong(ws);
      ws.send(JSON.stringify({ type: 'pong' }));
      for (const boardId of ws.data.subscribedBoards) {
        await cache.set(`presence:${boardId}:${ws.data.userId}`, ws.data.userId, 35);
      }
      return;
    }

    if (msg.type === 'subscribe' && msg.board_id) {
      const board = await db('boards').where({ id: msg.board_id }).first();
      if (!board) {
        ws.send(JSON.stringify({ type: 'error', name: 'board-not-found' }));
        return;
      }
      const member = await db('workspace_members')
        .where({ workspace_id: board.workspace_id, user_id: ws.data.userId })
        .first();
      if (!member) {
        ws.send(JSON.stringify({ type: 'error', name: 'not-a-member' }));
        return;
      }
      await subscribeToBoard({ ws, boardId: msg.board_id });
      return;
    }

    if (msg.type === 'unsubscribe' && msg.board_id) {
      await unsubscribeFromBoard({ ws, boardId: msg.board_id });
      return;
    }

    ws.send(JSON.stringify({ type: 'error', name: 'unknown-message-type' }));
  },

  async close(ws: ServerWebSocket<WsData>): Promise<void> {
    allSockets.delete(ws);
    for (const boardId of ws.data.subscribedBoards) {
      await unsubscribeFromBoard({ ws, boardId });
    }
  },
};
