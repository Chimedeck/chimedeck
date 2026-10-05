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
// CTX cache — 1-second TTL for card/list/board/member context reads.
// WHY: when a board has many cards, every card-badges handler calls
// t.list('id','name') which sends a CTX_LIST postMessage. Caching
// avoids redundant postMessage round-trips for identical requests.
// ────────────────────────────────────────────────────────────────────

const ctxCache = new Map<string, { value: unknown; expiresAt: number }>();
const CTX_CACHE_TTL = 1000; // 1 second

function getCachedCtx(cacheKey: string): unknown {
  const entry = ctxCache.get(cacheKey);
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  ctxCache.delete(cacheKey);
  return undefined;
}

function setCachedCtx(cacheKey: string, value: unknown): void {
  ctxCache.set(cacheKey, { value, expiresAt: Date.now() + CTX_CACHE_TTL });
}

// ────────────────────────────────────────────────────────────────────
// DATA_GET batching — collects individual DATA_GET requests over a
// 1-second window and flushes them as a single DATA_GET_BATCH message.
// WHY: on boards with many cards, each card's capability handler issues
// 4+ DATA_GET calls. Without batching, that's 4N HTTP requests to the
// server. With batching, all requests across all cards are collapsed
// into ONE server round-trip per 1-second window.
// ────────────────────────────────────────────────────────────────────

interface DataGetQueueItem {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  scope: Scope;
  visibility: Visibility;
  key: string;
  resourceId: string;
  boardId: string;
  cacheKey: string;
}

const dataGetQueue: DataGetQueueItem[] = [];
let dataGetFlushTimer: ReturnType<typeof setTimeout> | null = null;
const DATA_GET_BATCH_WINDOW = 1000; // 1 second
const DATA_GET_CACHE_TTL = 1000; // 1 second

// Cache for individual DATA_GET results — avoids re-enqueuing identical requests
const dataGetCache = new Map<string, { value: unknown; expiresAt: number }>();

// Maps batch request IDs to sub-id → promise handlers
const pendingBatch = new Map<
  string,
  Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; cacheKey: string }>
>();

function enqueueDataGet(item: DataGetQueueItem): void {
  dataGetQueue.push(item);
  dataGetFlushTimer ??= setTimeout(flushDataGetQueue, DATA_GET_BATCH_WINDOW);
}

function flushDataGetQueue(): void {
  dataGetFlushTimer = null;
  const batch = dataGetQueue.splice(0);
  if (batch.length === 0) return;

  const batchId = nextId();
  const subIdToEntry = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; cacheKey: string }
  >();

  const items = batch.map((item) => {
    const subId = nextId();
    subIdToEntry.set(subId, {
      resolve: item.resolve,
      reject: item.reject,
      cacheKey: item.cacheKey,
    });
    return {
      subId,
      scope: item.scope,
      visibility: item.visibility,
      key: item.key,
      resourceId: item.resourceId,
      boardId: item.boardId,
    };
  });

  pendingBatch.set(batchId, subIdToEntry);

  window.parent.postMessage(
    {
      jhSdk: true,
      id: batchId,
      type: 'DATA_GET_BATCH',
      payload: { items },
    },
    '*'
  );
}

// ────────────────────────────────────────────────────────────────────
// Pending promise registry — maps request IDs to resolve/reject pairs
// ────────────────────────────────────────────────────────────────────

const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

// ────────────────────────────────────────────────────────────────────
// Token cache — client-side storage for Trello-compatible tokens
// ────────────────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let cachedMemberId: string | null = null;

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

// Handle DATA_GET_BATCH responses — resolve individual sub-promises and cache results
function handleBatchResponse(
  batchId: string,
  results: Array<{ subId: string; result: unknown; error?: string }>
): void {
  const batchEntry = pendingBatch.get(batchId);
  if (!batchEntry) return;
  pendingBatch.delete(batchId);

  for (const item of results) {
    const entry = batchEntry.get(item.subId);
    if (!entry) continue;
    batchEntry.delete(item.subId);
    if (item.error) {
      entry.reject(new Error(item.error));
    } else {
      dataGetCache.set(entry.cacheKey, {
        value: item.result,
        expiresAt: Date.now() + DATA_GET_CACHE_TTL,
      });
      entry.resolve(item.result);
    }
  }
  // Reject any remaining sub-promises that didn't get a response
  for (const [, entry] of batchEntry) {
    entry.reject(new Error('No response for batched DATA_GET'));
  }
}

// Listen for responses from the host
window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as PostMessageResponse & {
    payload?: { results?: Array<{ subId: string; result: unknown; error?: string }> };
  };
  if (!data || !data.jhSdk || !data.id) return;

  // Handle DATA_GET_BATCH responses
  if (data.payload?.results) {
    handleBatchResponse(data.id, data.payload.results);
    return;
  }

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
    const resourceId = (this.args[scope] as Record<string, unknown> | undefined)?.id as
      | string
      | undefined;
    const boardId = (this.args.board as Record<string, unknown> | undefined)?.id as
      | string
      | undefined;

    if (!resourceId || !boardId) {
      return Promise.reject(new Error('Missing resourceId or boardId in context'));
    }

    // Check the 1-second DATA_GET cache first
    const cacheKey = `DATA_GET:${scope}:${visibility}:${key}:${resourceId}:${boardId}`;
    const cached = dataGetCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.value);
    }

    // Enqueue for batched flush — the result will be cached on response
    return new Promise((resolve, reject) => {
      enqueueDataGet({
        resolve,
        reject,
        scope,
        visibility,
        key,
        resourceId,
        boardId,
        cacheKey,
      });
    });
  }

  set(scope: Scope, visibility: Visibility, key: string, value: unknown): Promise<void> {
    // Auto-resolve resourceId and boardId from args injected by the host so the
    // plugin never has to pass them explicitly — they always match the current context.
    const resourceId = (this.args[scope] as Record<string, unknown> | undefined)?.id as
      | string
      | undefined;
    const boardId = (this.args.board as Record<string, unknown> | undefined)?.id as
      | string
      | undefined;

    // Invalidate the DATA_GET cache for this key so subsequent reads fetch fresh data
    if (resourceId && boardId) {
      const cacheKey = `DATA_GET:${scope}:${visibility}:${key}:${resourceId}:${boardId}`;
      dataGetCache.delete(cacheKey);
    }

    return sendToHost('DATA_SET', {
      scope,
      visibility,
      key,
      value,
      resourceId,
      boardId,
    }) as Promise<void>;
  }

  // ── Context reads ─────────────────────────────────────────────────

  private resolveContextFromArgs(
    key: 'card' | 'list' | 'board' | 'member',
    fields: string[]
  ): Record<string, unknown> | null {
    const raw = this.args[key];
    if (!raw || typeof raw !== 'object') return null;
    const source = raw as Record<string, unknown>;
    if (fields.length === 0) return source;

    const out: Record<string, unknown> = {};
    for (const field of fields) {
      if (!(field in source)) return null;
      out[field] = source[field];
    }
    return out;
  }

  card(...fields: string[]): Promise<Record<string, unknown>> {
    const cacheKey = `CTX_CARD:${String(this.args.card?.id ?? '')}:${fields.join(',')}`;
    const cached = getCachedCtx(cacheKey);
    if (cached !== undefined) return Promise.resolve(cached as Record<string, unknown>);

    const fromArgs = this.resolveContextFromArgs('card', fields);
    if (fromArgs) {
      setCachedCtx(cacheKey, fromArgs);
      return Promise.resolve(fromArgs);
    }

    return sendToHost('CTX_CARD', { fields }).then((result) => {
      setCachedCtx(cacheKey, result);
      return result as Record<string, unknown>;
    });
  }

  list(...fields: string[]): Promise<Record<string, unknown>> {
    const cacheKey = `CTX_LIST:${String(this.args.list?.id ?? '')}:${fields.join(',')}`;
    const cached = getCachedCtx(cacheKey);
    if (cached !== undefined) return Promise.resolve(cached as Record<string, unknown>);

    const fromArgs = this.resolveContextFromArgs('list', fields);
    if (fromArgs) {
      setCachedCtx(cacheKey, fromArgs);
      return Promise.resolve(fromArgs);
    }

    return sendToHost('CTX_LIST', { fields }).then((result) => {
      setCachedCtx(cacheKey, result);
      return result as Record<string, unknown>;
    });
  }

  board(...fields: string[]): Promise<Record<string, unknown>> {
    const cacheKey = `CTX_BOARD:${String(this.args.board?.id ?? '')}:${fields.join(',')}`;
    const cached = getCachedCtx(cacheKey);
    if (cached !== undefined) return Promise.resolve(cached as Record<string, unknown>);

    const fromArgs = this.resolveContextFromArgs('board', fields);
    if (fromArgs) {
      setCachedCtx(cacheKey, fromArgs);
      return Promise.resolve(fromArgs);
    }

    return sendToHost('CTX_BOARD', { fields }).then((result) => {
      setCachedCtx(cacheKey, result);
      return result as Record<string, unknown>;
    });
  }

  member(...fields: string[]): Promise<Record<string, unknown>> {
    const cacheKey = `CTX_MEMBER:${String(this.args.member?.id ?? '')}:${fields.join(',')}`;
    const cached = getCachedCtx(cacheKey);
    if (cached !== undefined) return Promise.resolve(cached as Record<string, unknown>);

    const fromArgs = this.resolveContextFromArgs('member', fields);
    if (fromArgs) {
      setCachedCtx(cacheKey, fromArgs);
      return Promise.resolve(fromArgs);
    }

    return sendToHost('CTX_MEMBER', { fields }).then((result) => {
      setCachedCtx(cacheKey, result);
      return result as Record<string, unknown>;
    });
  }

  // ── UI actions ────────────────────────────────────────────────────

  popup(options: {
    title: string;
    url: string;
    args?: Record<string, unknown>;
    mouseEvent?: MouseEvent;
  }): void {
    // WHY: auto-extract click coordinates from the BUTTON_CLICKED args so the host
    // can position the popup near the button that triggered it, instead of at (100,100).
    const clientX = (this.args.clientX as number | undefined) ?? options.mouseEvent?.clientX;
    const clientY = (this.args.clientY as number | undefined) ?? options.mouseEvent?.clientY;
    sendToHost('UI_POPUP', {
      ...options,
      mouseEvent: clientX !== undefined && clientY !== undefined ? { clientX, clientY } : undefined,
    });
  }

  modal(options: {
    title?: string;
    url: string;
    fullscreen?: boolean;
    accentColor?: string;
  }): void {
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
    const height =
      typeof element === 'string'
        ? (document.querySelector(element)?.scrollHeight ?? document.body.scrollHeight)
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

  authorize(options: { scope?: string; expiration?: string } = {}): Promise<void> {
    return sendToHost('API_AUTHORIZE', options) as Promise<void>;
  }

  // Return cached token if available, otherwise request a new one
  async getToken(): Promise<string | null> {
    if (cachedToken) {
      return cachedToken;
    }
    const token = (await sendToHost('API_GET_TOKEN', {})) as string | null;
    if (token) {
      cachedToken = token;
    }
    return token;
  }

  request(path: string, options?: RequestInit): Promise<Response> {
    return sendToHost('API_REQUEST', { path, options }) as Promise<Response>;
  }

  // [Trello compatibility] Store token for use by window.Trello.setToken()
  setToken(token: string | null): void {
    cachedToken = token;
    // When token is set, assume we have a valid member (use a placeholder ID)
    // The actual member ID would come from the API authorization response
    if (token) {
      cachedMemberId = 'me';
    } else {
      cachedMemberId = null;
    }
  }

  // [Trello compatibility] Clear cached token
  clearToken(): Promise<void> {
    cachedToken = null;
    cachedMemberId = null;
    return Promise.resolve();
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

  const { id, payload } = data as {
    jhSdk: true;
    id: string;
    type: string;
    payload: { capability: string; args?: Record<string, unknown>; options?: unknown };
  };
  const { capability, args = {}, options } = payload;

  const handler = capabilityHandlers.get(capability);
  const t = new FrameContext(args);

  try {
    const raw = handler ? await handler(t, options) : undefined;
    // Serialize callbacks so they survive the postMessage boundary
    const result = serializeResult(raw);
    window.parent.postMessage(
      {
        jhSdk: true,
        id: nextId(),
        type: 'RESOLVE_CAPABILITY_RESPONSE',
        payload: { requestId: id, result },
      },
      '*'
    );
  } catch (err) {
    window.parent.postMessage(
      {
        jhSdk: true,
        id: nextId(),
        type: 'RESOLVE_CAPABILITY_RESPONSE',
        payload: { requestId: id, result: null },
      },
      '*'
    );
  }
});

// Handle BUTTON_CLICKED — host dispatches this when a button registered by a plugin is clicked.
// Look up the callback by its opaque ID and invoke it with a fresh FrameContext.
window.addEventListener('message', async (event: MessageEvent) => {
  const data = event.data as PostMessageRequest & {
    payload?: { callbackId?: string; args?: Record<string, unknown> };
  };
  if (!data || !data.jhSdk || data.type !== 'BUTTON_CLICKED') return;

  const { callbackId, args = {} } = (data.payload ?? {}) as {
    callbackId?: string;
    args?: Record<string, unknown>;
  };
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

let initialized = false;

const jhInstance = {
  /**
   * Register capability handlers and signal readiness to the host.
   * Call once in connector.html / client.js.
   *
   * Idempotent — subsequent calls are no-ops. This guards against
   * React StrictMode double-mounting (which destroys and recreates
   * the iframe, causing the SDK script to re-execute) and any other
   * edge case that might reload the plugin iframe.
   */
  initialize(capabilities: Record<string, CapabilityHandler>, config: JhInstanceConfig): void {
    if (initialized) return;
    initialized = true;

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
// Trello compatibility object — window.Trello for Power-Up compatibility
// ────────────────────────────────────────────────────────────────────

const trelloCompat = {
  /**
   * [Trello compatibility] Set the token for future Trello API calls.
   * Caches token in module scope so subsequent getToken() calls can reuse it.
   */
  setToken(token: string | null): void {
    cachedToken = token;
    if (token) {
      cachedMemberId = 'me';
    } else {
      cachedMemberId = null;
    }
  },

  /**
   * [Trello compatibility] Namespace for member operations.
   */
  members: {
    /**
     * Get member info — returns cached member data if token was set,
     * otherwise throws to indicate the token is not available.
     */
    get(_memberId: 'me'): Promise<{ id: string }> {
      if (cachedMemberId && cachedToken) {
        return Promise.resolve({
          id: cachedMemberId,
        });
      }

      // Throw if no token is cached — indicates authorization is required
      return Promise.reject(
        new Error('No token available. Call t.getRestApi().authorize() first.')
      );
    },
  },
};

// ────────────────────────────────────────────────────────────────────
// Attach to global scope — must run in browser context
// ────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    jhInstance: typeof jhInstance;
    TrelloPowerUp: typeof jhInstance;
    Trello: typeof trelloCompat;
  }
}

window.jhInstance = jhInstance;

// Compatibility shim: alias so existing TrelloPowerUp client.js files work unchanged
window.TrelloPowerUp = jhInstance;

// Trello compatibility: expose window.Trello for Power-Up client code
window.Trello = trelloCompat;
