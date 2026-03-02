// Singleton WebSocket client with reconnect backoff, room subscribe/unsubscribe,
// and event dispatch. Used by useWebSocket hook and wsMiddleware.
//
// WHY singleton: one physical WebSocket per browser tab is enough; all Redux
// middleware and React hooks share the same connection object.

export type WsEventHandler = (event: RealtimeEvent) => void;

export interface RealtimeEvent {
  type: string;
  board_id?: string;
  sequence?: number;
  payload?: unknown;
}

interface SocketOptions {
  /** Called when the connection opens (or re-opens after reconnect) */
  onOpen?: () => void;
  /** Called when the connection closes unexpectedly */
  onClose?: () => void;
  /** Called on each incoming parsed event */
  onEvent?: WsEventHandler;
}

// Exponential backoff caps at 30 s
const MAX_BACKOFF_MS = 30_000;

class RealtimeSocket {
  private ws: WebSocket | null = null;
  private boardId: string | null = null;
  private token: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 1_000;
  private intentionalClose = false;

  private handlers: Set<WsEventHandler> = new Set();
  private openHandlers: Set<() => void> = new Set();
  private closeHandlers: Set<() => void> = new Set();

  // ---------- Public API ----------

  connect({ boardId, token }: { boardId: string; token: string }) {
    this.boardId = boardId;
    this.token = token;
    this.intentionalClose = false;
    this._open();
  }

  disconnect() {
    this.intentionalClose = true;
    this._clearReconnect();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe({ onEvent, onOpen, onClose }: SocketOptions): () => void {
    if (onEvent) this.handlers.add(onEvent);
    if (onOpen) this.openHandlers.add(onOpen);
    if (onClose) this.closeHandlers.add(onClose);
    return () => {
      if (onEvent) this.handlers.delete(onEvent);
      if (onOpen) this.openHandlers.delete(onOpen);
      if (onClose) this.closeHandlers.delete(onClose);
    };
  }

  send(message: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ---------- Internal ----------

  private _open() {
    if (!this.boardId || !this.token) return;

    const url = `${this._wsBase()}/api/v1/ws?token=${encodeURIComponent(this.token)}`;
    this.ws = new WebSocket(url);

    this.ws.addEventListener('open', () => {
      this.backoffMs = 1_000;
      // Subscribe to the board room after authentication handshake
      this.send({ type: 'subscribe', board_id: this.boardId });
      this.openHandlers.forEach((h) => h());
    });

    this.ws.addEventListener('message', (ev: MessageEvent<string>) => {
      try {
        const event = JSON.parse(ev.data) as RealtimeEvent;
        this.handlers.forEach((h) => h(event));
      } catch {
        // Ignore malformed frames
      }
    });

    this.ws.addEventListener('close', () => {
      this.closeHandlers.forEach((h) => h());
      if (!this.intentionalClose) {
        this._scheduleReconnect();
      }
    });

    this.ws.addEventListener('error', () => {
      // 'close' will fire right after; reconnect is handled there
    });
  }

  private _scheduleReconnect() {
    this._clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
      this._open();
    }, this.backoffMs);
  }

  private _clearReconnect() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _wsBase(): string {
    if (typeof window === 'undefined') return 'ws://localhost:3000';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
}

// Module-level singleton
export const socket = new RealtimeSocket();
