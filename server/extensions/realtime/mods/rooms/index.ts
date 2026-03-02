// server/extensions/realtime/mods/rooms/index.ts
// In-process room registry: Map<boardId, Set<ServerWebSocket>>.
import type { ServerWebSocket } from 'bun';

export interface WsData {
  userId: string;
  token: string;
  subscribedBoards: Set<string>;
}

// The global room registry.
export const rooms = new Map<string, Set<ServerWebSocket<WsData>>>();
