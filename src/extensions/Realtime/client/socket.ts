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
  /** Epoch ms when the server published this event — used to compute propagation delay. */
  emittedAt?: number;
  payload?: unknown;
}

interface SocketOptions {
  /** Called when the connection opens (or re-opens after reconnect) */
  onOpen?: () => void;
  /** Called when the connection closes unexpectedly */
  onClose?: () => void;
  /** Called on each incoming parsed event */
  onEvent?: WsEventHandler;
  /** Called when failed WS attempts reach the threshold — switch to polling */
  onPollingActive?: () => void;
  /** Called when WS reconnects successfully after polling mode was active */
  onPollingInactive?: () => void;
}

// Exponential backoff caps at 30 s
const MAX_BACKOFF_MS = 30_000;
// Number of consecutive WS failures before activating HTTP polling fallback
const POLLING_FALLBACK_THRESHOLD = 3;

class RealtimeSocket {
  private ws: WebSocket | null = null;
  private boardId: string | null = null;
  private token: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 1_000;
  private intentionalClose = false;
  private failedAttempts = 0;

  private handlers: Set<WsEventHandler> = new Set();
  private openHandlers: Set<() => void> = new Set();
  private closeHandlers: Set<() => void> = new Set();
  private pollingActiveHandlers: Set<() => void> = new Set();
  private pollingInactiveHandlers: Set<() => void> = new Set();

  // Callback for forced server-side logout (WS close code 4001).
  // Set from main.tsx to avoid circular dependency with the store.
  private forcedLogoutCallback: (() => void) | null = null;

  setForcedLogoutCallback(fn: () => void) {
    this.forcedLogoutCallback = fn;
  }

  /** True when consecutive WS failures have reached the polling threshold */
  get usingPollingFallback(): boolean {
    return this.failedAttempts >= POLLING_FALLBACK_THRESHOLD;
  }

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

  subscribe({ onEvent, onOpen, onClose, onPollingActive, onPollingInactive }: SocketOptions): () => void {
    if (onEvent) this.handlers.add(onEvent);
    if (onOpen) this.openHandlers.add(onOpen);
    if (onClose) this.closeHandlers.add(onClose);
    if (onPollingActive) this.pollingActiveHandlers.add(onPollingActive);
    if (onPollingInactive) this.pollingInactiveHandlers.add(onPollingInactive);
    return () => {
      if (onEvent) this.handlers.delete(onEvent);
      if (onOpen) this.openHandlers.delete(onOpen);
      if (onClose) this.closeHandlers.delete(onClose);
      if (onPollingActive) this.pollingActiveHandlers.delete(onPollingActive);
      if (onPollingInactive) this.pollingInactiveHandlers.delete(onPollingInactive);
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
      const wasPolling = this.failedAttempts >= POLLING_FALLBACK_THRESHOLD;
      this.backoffMs = 1_000;
      this.failedAttempts = 0;
      // Subscribe to the board room after authentication handshake
      this.send({ type: 'subscribe', board_id: this.boardId });
      this.openHandlers.forEach((h) => h());
      // Notify that polling is no longer needed now that WS is back
      if (wasPolling) {
        this.pollingInactiveHandlers.forEach((h) => h());
      }
    });

    this.ws.addEventListener('message', (ev: MessageEvent<string>) => {
      try {
        const event = JSON.parse(ev.data) as RealtimeEvent;
        this.handlers.forEach((h) => h(event));
      } catch {
        // Ignore malformed frames
      }
    });

    this.ws.addEventListener('close', (ev: CloseEvent) => {
      // Code 4001 = server-initiated forced logout (session revoked)
      if (ev.code === 4001) {
        this.intentionalClose = true;
        this.forcedLogoutCallback?.();
        return;
      }
      this.failedAttempts++;
      this.closeHandlers.forEach((h) => h());
      if (!this.intentionalClose) {
        // Activate polling fallback once threshold is reached
        if (this.failedAttempts === POLLING_FALLBACK_THRESHOLD) {
          this.pollingActiveHandlers.forEach((h) => h());
        }
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
