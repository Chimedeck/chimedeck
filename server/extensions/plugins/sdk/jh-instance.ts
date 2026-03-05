/**
 * jhInstance SDK — browser-side plugin SDK served at /sdk/jh-instance.js.
 *
 * Plugin connector pages load this script and call jhInstance.initialize(capabilities, config)
 * to register capability handlers. Communication with the host board UI is brokered
 * via postMessage over the iframe boundary.
 *
 * API surface is intentionally compatible with the Trello Power-Up TrelloPowerUp API
 * so existing Power-Up client.js files can alias: window.TrelloPowerUp = window.jhInstance
 */

// ────────────────────────────────────────────────────────────────────
// Message types exchanged between the SDK (iframe) and the host (board UI)
// ────────────────────────────────────────────────────────────────────

type Scope = 'card' | 'list' | 'board' | 'member';
type Visibility = 'private' | 'shared';

interface PostMessageRequest {
  jhSdk: true;
  id: string;
  type: string;
  payload?: unknown;
}

interface PostMessageResponse {
  jhSdk: true;
  id: string;
  result?: unknown;
  error?: string;
}

// ────────────────────────────────────────────────────────────────────
// Pending promise registry — maps request IDs to resolve/reject pairs
// ────────────────────────────────────────────────────────────────────

const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

// ────────────────────────────────────────────────────────────────────
// Callback registry — stores functions replaced by opaque IDs so they
// can survive the postMessage serialization boundary
// ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callbackRegistry = new Map<string, (...args: any[]) => unknown>();

/**
 * Walk `value` recursively; replace every function with { __callbackId }
 * and store the original function in callbackRegistry keyed by that ID.
 */
function serializeResult(value: unknown): unknown {
  if (typeof value === 'function') {
    const id = nextId();
    callbackRegistry.set(id, value as (...args: unknown[]) => unknown);
    return { __callbackId: id };
  }
  if (Array.isArray(value)) {
    return value.map(serializeResult);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeResult(v);
    }
    return out;
  }
  return value;
}

let msgCounter = 0;
function nextId(): string {
  return `jh-${Date.now()}-${++msgCounter}`;
}

function sendToHost(type: string, payload?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = nextId();
    pending.set(id, { resolve, reject });
    const msg: PostMessageRequest = { jhSdk: true, id, type, payload };
    window.parent.postMessage(msg, '*');
  });
}

// Listen for responses from the host
window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as PostMessageResponse;
  if (!data || !data.jhSdk || !data.id) return;

  const entry = pending.get(data.id);
  if (!entry) return;
  pending.delete(data.id);

  if (data.error) {
    entry.reject(new Error(data.error));
  } else {
    entry.resolve(data.result);
  }
});

// ────────────────────────────────────────────────────────────────────
// FrameContext — the `t` object passed into every capability handler
// ────────────────────────────────────────────────────────────────────

class FrameContext {
  /** Extra args injected by the host when opening modals / sections */
  readonly args: Record<string, unknown>;

  constructor(args: Record<string, unknown> = {}) {
    this.args = args;
  }

  arg(key: string): unknown {
    return this.args[key];
  }

  // ── Data storage ──────────────────────────────────────────────────

  get(scope: Scope, visibility: Visibility, key: string): Promise<unknown> {
    // Auto-resolve resourceId and boardId from args injected by the host so the
    // plugin never has to pass them explicitly — they always match the current context.
    const resourceId = (this.args[scope] as Record<string, unknown> | undefined)?.id as string | undefined;
    const boardId = (this.args.board as Record<string, unknown> | undefined)?.id as string | undefined;
    return sendToHost('DATA_GET', { scope, visibility, key, resourceId, boardId });
  }

  set(scope: Scope, visibility: Visibility, key: string, value: unknown): Promise<void> {
    // Auto-resolve resourceId and boardId from args injected by the host so the
    // plugin never has to pass them explicitly — they always match the current context.
    const resourceId = (this.args[scope] as Record<string, unknown> | undefined)?.id as string | undefined;
    const boardId = (this.args.board as Record<string, unknown> | undefined)?.id as string | undefined;
    return sendToHost('DATA_SET', { scope, visibility, key, value, resourceId, boardId }) as Promise<void>;
  }

  // ── Context reads ─────────────────────────────────────────────────

  card(...fields: string[]): Promise<Record<string, unknown>> {
    return sendToHost('CTX_CARD', { fields }) as Promise<Record<string, unknown>>;
  }

  list(...fields: string[]): Promise<Record<string, unknown>> {
    return sendToHost('CTX_LIST', { fields }) as Promise<Record<string, unknown>>;
  }

  board(...fields: string[]): Promise<Record<string, unknown>> {
    return sendToHost('CTX_BOARD', { fields }) as Promise<Record<string, unknown>>;
  }

  member(...fields: string[]): Promise<Record<string, unknown>> {
    return sendToHost('CTX_MEMBER', { fields }) as Promise<Record<string, unknown>>;
  }

  // ── UI actions ────────────────────────────────────────────────────

  popup(options: { title: string; url: string; args?: Record<string, unknown>; mouseEvent?: MouseEvent }): void {
    sendToHost('UI_POPUP', options);
  }

  modal(options: { title?: string; url: string; fullscreen?: boolean; accentColor?: string }): void {
    sendToHost('UI_MODAL', options);
  }

  updateModal(options: Partial<{ title: string; fullscreen: boolean; accentColor: string }>): void {
    sendToHost('UI_UPDATE_MODAL', options);
  }

  closePopup(): void {
    sendToHost('UI_CLOSE_POPUP', {});
  }

  closeModal(): void {
    sendToHost('UI_CLOSE_MODAL', {});
  }

  sizeTo(element: HTMLElement | string): void {
    const selector = typeof element === 'string' ? element : null;
    const height = typeof element === 'string'
      ? document.querySelector(element)?.scrollHeight ?? document.body.scrollHeight
      : element.scrollHeight;
    sendToHost('UI_SIZE_TO', { height, selector });
  }

  render(fn: () => void): void {
    fn();
  }

  // ── REST API client (stubbed — authorisation flows added in later iterations) ──

  getRestApi(): RestApiClient {
    return new RestApiClient();
  }
}

// ────────────────────────────────────────────────────────────────────
// RestApiClient — placeholder for future authorisation / token flows
// ────────────────────────────────────────────────────────────────────

class RestApiClient {
  isAuthorized(): Promise<boolean> {
    return sendToHost('API_IS_AUTHORIZED', {}) as Promise<boolean>;
  }

  authorize(options: { scope?: string } = {}): Promise<void> {
    return sendToHost('API_AUTHORIZE', options) as Promise<void>;
  }

  getToken(): Promise<string | null> {
    return sendToHost('API_GET_TOKEN', {}) as Promise<string | null>;
  }

  request(path: string, options?: RequestInit): Promise<Response> {
    return sendToHost('API_REQUEST', { path, options }) as Promise<Response>;
  }
}

// ────────────────────────────────────────────────────────────────────
// Capability dispatch — host sends CAPABILITY_INVOKE; SDK routes to handler
// ────────────────────────────────────────────────────────────────────

type CapabilityHandler = (t: FrameContext, options?: unknown) => unknown | Promise<unknown>;

const capabilityHandlers = new Map<string, CapabilityHandler>();

window.addEventListener('message', async (event: MessageEvent) => {
  const data = event.data as PostMessageRequest & { capability?: string; options?: unknown };
  if (!data || !data.jhSdk || data.type !== 'CAPABILITY_INVOKE') return;

  const { id, payload } = data as { jhSdk: true; id: string; type: string; payload: { capability: string; args?: Record<string, unknown>; options?: unknown } };
  const { capability, args = {}, options } = payload;

  const handler = capabilityHandlers.get(capability);
  const t = new FrameContext(args);

  try {
    const raw = handler ? await handler(t, options) : undefined;
    // Serialize callbacks so they survive the postMessage boundary
    const result = serializeResult(raw);
    window.parent.postMessage(
      { jhSdk: true, id: nextId(), type: 'RESOLVE_CAPABILITY_RESPONSE', payload: { requestId: id, result } },
      '*',
    );
  } catch (err) {
    window.parent.postMessage(
      { jhSdk: true, id: nextId(), type: 'RESOLVE_CAPABILITY_RESPONSE', payload: { requestId: id, result: null } },
      '*',
    );
  }
});

// Handle BUTTON_CLICKED — host dispatches this when a button registered by a plugin is clicked.
// Look up the callback by its opaque ID and invoke it with a fresh FrameContext.
window.addEventListener('message', async (event: MessageEvent) => {
  const data = event.data as PostMessageRequest & { payload?: { callbackId?: string; args?: Record<string, unknown> } };
  if (!data || !data.jhSdk || data.type !== 'BUTTON_CLICKED') return;

  const { callbackId, args = {} } = (data.payload ?? {}) as { callbackId?: string; args?: Record<string, unknown> };
  if (!callbackId) return;

  const cb = callbackRegistry.get(callbackId);
  if (!cb) return; // Not our callback — this BUTTON_CLICKED belongs to a different plugin iframe

  const t = new FrameContext(args);
  try {
    await cb(t);
  } catch (err) {
    // Swallow errors so a broken plugin callback can't crash the SDK
    console.error('[jhInstance] BUTTON_CLICKED callback error:', err);
  }
});

// ────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────

interface JhInstanceConfig {
  appKey: string;
  appName: string;
}

const jhInstance = {
  /**
   * Register capability handlers and signal readiness to the host.
   * Call once in connector.html / client.js.
   */
  initialize(
    capabilities: Record<string, CapabilityHandler>,
    config: JhInstanceConfig
  ): void {
    for (const [name, handler] of Object.entries(capabilities)) {
      capabilityHandlers.set(name, handler);
    }

    // Notify the host that the plugin iframe is ready
    const msg: PostMessageRequest = {
      jhSdk: true,
      id: nextId(),
      type: 'PLUGIN_READY',
      payload: {
        capabilities: Object.keys(capabilities),
        appKey: config.appKey,
        appName: config.appName,
      },
    };
    window.parent.postMessage(msg, '*');
  },

  /**
   * Used in non-connector pages (modals, sections) to obtain the FrameContext
   * with args injected by the host in the iframe URL query string.
   */
  iframe(): FrameContext {
    const params = new URLSearchParams(window.location.search);
    const args: Record<string, unknown> = {};
    params.forEach((value, key) => {
      try {
        args[key] = JSON.parse(value);
      } catch {
        args[key] = value;
      }
    });
    return new FrameContext(args);
  },

  /**
   * Expose FrameContext constructor for advanced use cases.
   * Compatible with TrelloPowerUp.iframe() pattern.
   */
  FrameContext,
};

// ────────────────────────────────────────────────────────────────────
// Attach to global scope — must run in browser context
// ────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    jhInstance: typeof jhInstance;
    TrelloPowerUp: typeof jhInstance;
  }
}

window.jhInstance = jhInstance;

// Compatibility shim: alias so existing TrelloPowerUp client.js files work unchanged
window.TrelloPowerUp = jhInstance;

export default jhInstance;
