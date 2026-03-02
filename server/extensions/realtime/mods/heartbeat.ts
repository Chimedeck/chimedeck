// server/extensions/realtime/mods/heartbeat.ts
// 30s ping interval; evicts connections that have not ponged within 60s.
import type { ServerWebSocket } from 'bun';
import type { WsData } from './rooms/index';
import { unsubscribeFromBoard } from './rooms/unsubscribe';

const lastPong = new WeakMap<ServerWebSocket<WsData>, number>();

export function recordPong(ws: ServerWebSocket<WsData>): void {
  lastPong.set(ws, Date.now());
}

export function initHeartbeat(ws: ServerWebSocket<WsData>): void {
  lastPong.set(ws, Date.now());
}

export function startHeartbeatLoop(
  getActiveSockets: () => Iterable<ServerWebSocket<WsData>>,
): void {
  setInterval(() => {
    const now = Date.now();
    for (const ws of getActiveSockets()) {
      const last = lastPong.get(ws) ?? now;
      if (now - last > 60_000) {
        for (const boardId of ws.data.subscribedBoards) {
          unsubscribeFromBoard({ ws, boardId }).catch(() => {});
        }
        ws.close(1001, 'heartbeat timeout');
      } else {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }
  }, 30_000);
}
