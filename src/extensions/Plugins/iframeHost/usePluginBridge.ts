// usePluginBridge — manages the two-way postMessage protocol between the board
// host and all active plugin iframes.
//
// Security: all incoming messages are validated against the plugin's registered
// connector_url origin. Messages from unknown origins are silently ignored.
//
// Provided via PluginBridgeContext so any component can call bridge.resolve()
// without prop-drilling.

import { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import type { BoardPlugin } from '../api';
import { apiClient } from '~/common/api/client';
import type { PluginModalState } from '../modals/PluginModal';
import type { PluginPopupState } from '../modals/PluginPopup';

// ─── Message shapes (mirrored from jh-instance.ts) ────────────────────────

interface SdkMessage {
  jhSdk: true;
  id: string;
  type: string;
  payload?: unknown;
}

interface SdkResponse {
  jhSdk: true;
  id: string;
  result?: unknown;
  error?: string;
}

export interface CapabilityContext {
  card?: Record<string, unknown>;
  list?: Record<string, unknown>;
  board?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── Pending capability requests ─────────────────────────────────────────

interface PendingCapabilityRequest {
  resolve: (results: unknown[]) => void;
  results: unknown[];
  remaining: number;
}

// ─── Bridge public API ────────────────────────────────────────────────────

export interface PluginBridge {
  /**
   * Ask all active plugins for their capability results.
   * Returns an array of values, one per responding plugin.
   */
  resolve(capability: string, context: CapabilityContext): Promise<unknown[]>;
  /**
   * Send a raw SDK message to a specific plugin iframe.
   */
  sendToPlugin(pluginId: string, message: SdkMessage): void;
}

// ─── Context ──────────────────────────────────────────────────────────────

export const PluginBridgeContext = createContext<PluginBridge | null>(null);

export function usePluginBridgeContext(): PluginBridge | null {
  return useContext(PluginBridgeContext);
}

// ─── Hook ─────────────────────────────────────────────────────────────────

interface UsePluginBridgeOptions {
  boardId: string;
  plugins: BoardPlugin[];
  currentUserId?: string | null;
  onOpenModal?: (state: Omit<PluginModalState, 'open'>) => void;
  onCloseModal?: () => void;
  onUpdateModal?: (update: Partial<Pick<PluginModalState, 'title' | 'fullscreen' | 'accentColor'>>) => void;
  onOpenPopup?: (state: Omit<PluginPopupState, 'open'>) => void;
  onClosePopup?: () => void;
  onSizeTo?: (height: number) => void;
}

interface PluginState {
  capabilities: string[];
  origin: string;
  iframeId: string;
}

export function usePluginBridge({
  boardId,
  plugins,
  currentUserId,
  onOpenModal,
  onCloseModal,
  onUpdateModal,
  onOpenPopup,
  onClosePopup,
  onSizeTo,
}: UsePluginBridgeOptions): PluginBridge {
  // Map of pluginId → registered state (capabilities, allowed origin)
  const pluginStateRef = useRef<Map<string, PluginState>>(new Map());
  // Pending DATA_GET / DATA_SET request replies keyed by message id
  const pendingDataRef = useRef<Map<string, (response: SdkResponse) => void>>(new Map());
  // Pending capability resolution requests keyed by capability request id
  const pendingCapabilityRef = useRef<Map<string, PendingCapabilityRequest>>(new Map());
  // Last context sent to each plugin via CAPABILITY_INVOKE, used to answer CTX_* queries
  const pluginContextRef = useRef<Map<string, CapabilityContext>>(new Map());

  // Derive allowed origins from active plugins
  const getAllowedOrigins = useCallback((): Map<string, string> => {
    const map = new Map<string, string>();
    for (const bp of plugins) {
      try {
        const url = new URL(bp.plugin.connectorUrl);
        map.set(bp.plugin.id, url.origin);
      } catch {
        // Skip malformed URLs
      }
    }
    return map;
  }, [plugins]);

  // Find plugin by origin
  const findPluginByOrigin = useCallback(
    (origin: string): BoardPlugin | undefined => {
      return plugins.find((bp) => {
        try {
          return new URL(bp.plugin.connectorUrl).origin === origin;
        } catch {
          return false;
        }
      });
    },
    [plugins],
  );

  // Send a message to a specific plugin iframe
  const sendToPlugin = useCallback((pluginId: string, message: SdkMessage) => {
    const iframeId = `plugin-iframe-${pluginId}`;
    const iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
    if (!iframe?.contentWindow) return;

    const allowedOrigins = getAllowedOrigins();
    const targetOrigin = allowedOrigins.get(pluginId) ?? '*';
    iframe.contentWindow.postMessage(message, targetOrigin);
  }, [getAllowedOrigins]);

  // Handle DATA_GET — proxy request to server plugin-data API
  const handleDataGet = useCallback(
    async (
      bp: BoardPlugin,
      msg: SdkMessage & { payload: { scope: string; visibility: string; key: string; resourceId?: string } },
    ) => {
      const { scope, visibility, key, resourceId } = msg.payload;
      let result: unknown = null;
      try {
        const apiKey = bp.plugin.apiKey;
        if (!apiKey) throw new Error('missing-plugin-api-key');

        const params = new URLSearchParams({
          scope,
          key,
          visibility,
          pluginId: bp.plugin.id,
          boardId,
        });
        if (resourceId) params.set('resourceId', resourceId);
        if (visibility === 'private' && currentUserId) {
          params.set('userId', currentUserId);
        }
        const resp = await apiClient.get<{ data: { value: unknown } }>(
          `/plugins/data?${params.toString()}`,
          {
            headers: {
              Authorization: `ApiKey ${apiKey}`,
            },
          },
        );
        result = (resp as unknown as { data: { value: unknown } }).data?.value ?? null;
      } catch {
        result = null;
      }
      const response: SdkResponse = { jhSdk: true, id: msg.id, result };
      sendToPlugin(bp.plugin.id, response as unknown as SdkMessage);
    },
    [boardId, currentUserId, sendToPlugin],
  );

  // Handle DATA_SET — proxy request to server plugin-data API
  const handleDataSet = useCallback(
    async (
      bp: BoardPlugin,
      msg: SdkMessage & { payload: { scope: string; visibility: string; key: string; value: unknown; resourceId?: string } },
    ) => {
      const { scope, visibility, key, value, resourceId } = msg.payload;
      try {
        const apiKey = bp.plugin.apiKey;
        if (!apiKey) throw new Error('missing-plugin-api-key');

        await apiClient.put('/plugins/data', {
          scope,
          key,
          value,
          visibility,
          pluginId: bp.plugin.id,
          boardId,
          resourceId,
          ...(visibility === 'private' && currentUserId ? { userId: currentUserId } : {}),
        }, {
          headers: {
            Authorization: `ApiKey ${apiKey}`,
          },
        });
        const response: SdkResponse = { jhSdk: true, id: msg.id, result: null };
        sendToPlugin(bp.plugin.id, response as unknown as SdkMessage);
      } catch (err) {
        const response: SdkResponse = {
          jhSdk: true,
          id: msg.id,
          error: err instanceof Error ? err.message : 'data-set-failed',
        };
        sendToPlugin(bp.plugin.id, response as unknown as SdkMessage);
      }
    },
    [boardId, currentUserId, sendToPlugin],
  );

  // Extract only the requested fields from a context object.
  // If fields is empty/undefined, return the entire object.
  const extractContextFields = useCallback(
    (obj: Record<string, unknown> | null | undefined, fields?: string[]): Record<string, unknown> | null => {
      if (!obj) return null;
      if (!fields || fields.length === 0) return obj;
      return Object.fromEntries(fields.filter((f) => f in obj).map((f) => [f, obj[f]]));
    },
    [],
  );

  // Handle CTX_* queries — return the relevant portion of the last CAPABILITY_INVOKE context
  const handleCtxQuery = useCallback(
    (bp: BoardPlugin, msg: SdkMessage, contextKey: keyof CapabilityContext) => {
      const payload = msg.payload as { fields?: string[] } | undefined;
      const ctx = pluginContextRef.current.get(bp.plugin.id);
      const raw = ctx?.[contextKey] as Record<string, unknown> | undefined;
      const result = extractContextFields(raw, payload?.fields);
      const response: SdkResponse = { jhSdk: true, id: msg.id, result };
      sendToPlugin(bp.plugin.id, response as unknown as SdkMessage);
    },
    [extractContextFields, sendToPlugin],
  );

  // Handle RESOLVE_CAPABILITY_RESPONSE — plugin answered a capability request
  const handleCapabilityResponse = useCallback(
    (msg: SdkMessage & { payload: { requestId: string; result: unknown } }) => {
      const { requestId, result } = msg.payload;
      const pending = pendingCapabilityRef.current.get(requestId);
      if (!pending) return;
      pending.results.push(result);
      pending.remaining -= 1;
      if (pending.remaining <= 0) {
        pending.resolve(pending.results);
        pendingCapabilityRef.current.delete(requestId);
      }
    },
    [],
  );

  // Compute effective allowed domains for a plugin.
  // Returns null if there is no domain restriction (all origins allowed),
  // or a string[] if only those origins are permitted.
  const getEffectiveDomains = useCallback(
    (bp: BoardPlugin): string[] | null => {
      const whitelisted = bp.plugin.whitelistedDomains ?? [];
      // If the plugin declares no domains, no domain restriction applies.
      if (whitelisted.length === 0) return null;
      const allowed = bp.config?.allowedDomains;
      // null / undefined → no restriction set by board admin → all whitelisted are permitted
      if (allowed == null) return null;
      // array → restrict to this subset
      return allowed;
    },
    [plugins],
  );

  // Check whether a URL is permitted by the plugin's effective domain list.
  // Returns true if permitted, false if blocked.
  const isDomainAllowed = useCallback(
    (bp: BoardPlugin, url: string): boolean => {
      const effectiveDomains = getEffectiveDomains(bp);
      if (effectiveDomains === null) return true; // no restriction
      try {
        const origin = new URL(url).origin;
        return effectiveDomains.includes(origin);
      } catch {
        return false; // malformed URL → block
      }
    },
    [getEffectiveDomains],
  );

  // Send a domain-not-allowed error response back to the plugin
  const sendDomainError = useCallback(
    (bp: BoardPlugin, msgId: string) => {
      const response: SdkResponse = {
        jhSdk: true,
        id: msgId,
        error: 'domain-not-allowed',
      };
      sendToPlugin(bp.plugin.id, response as unknown as SdkMessage);
    },
    [sendToPlugin],
  );

  // Global message listener
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as SdkMessage;
      // Only process messages tagged by our SDK
      if (!data || !data.jhSdk) return;

      // Validate origin against whitelisted plugin origins
      const bp = findPluginByOrigin(event.origin);
      if (!bp) {
        // Silently ignore messages from unknown origins
        return;
      }

      switch (data.type) {
        case 'PLUGIN_READY': {
          const payload = data.payload as { capabilities: string[] };
          pluginStateRef.current.set(bp.plugin.id, {
            capabilities: payload?.capabilities ?? [],
            origin: event.origin,
            iframeId: `plugin-iframe-${bp.plugin.id}`,
          });
          break;
        }
        case 'DATA_GET':
          void handleDataGet(
            bp,
            data as SdkMessage & { payload: { scope: string; visibility: string; key: string; resourceId?: string } },
          );
          break;
        case 'DATA_SET':
          void handleDataSet(
            bp,
            data as SdkMessage & { payload: { scope: string; visibility: string; key: string; value: unknown; resourceId?: string } },
          );
          break;
        case 'RESOLVE_CAPABILITY_RESPONSE':
          handleCapabilityResponse(
            data as SdkMessage & { payload: { requestId: string; result: unknown } },
          );
          break;
        case 'CTX_CARD':
          handleCtxQuery(bp, data, 'card');
          break;
        case 'CTX_LIST':
          handleCtxQuery(bp, data, 'list');
          break;
        case 'CTX_BOARD':
          handleCtxQuery(bp, data, 'board');
          break;
        case 'CTX_MEMBER':
          handleCtxQuery(bp, data, 'member');
          break;
        case 'UI_MODAL': {
          const payload = data.payload as {
            url: string;
            title?: string;
            fullscreen?: boolean;
            accentColor?: string;
          };
          if (!isDomainAllowed(bp, payload.url)) {
            sendDomainError(bp, data.id);
            break;
          }
          const modalState: Omit<PluginModalState, 'open'> = {
            url: payload.url,
            title: payload.title ?? '',
            fullscreen: payload.fullscreen ?? false,
            pluginId: bp.plugin.id,
          };
          if (payload.accentColor !== undefined) {
            modalState.accentColor = payload.accentColor;
          }
          onOpenModal?.(modalState);
          break;
        }
        case 'UI_CLOSE_MODAL':
          onCloseModal?.();
          break;
        case 'UI_UPDATE_MODAL': {
          const payload = data.payload as Partial<{
            title: string;
            fullscreen: boolean;
            accentColor: string;
          }>;
          onUpdateModal?.(payload);
          break;
        }
        case 'UI_POPUP': {
          const payload = data.payload as {
            url: string;
            title?: string;
            args?: Record<string, unknown>;
            mouseEvent?: { clientX?: number; clientY?: number };
          };
          if (!isDomainAllowed(bp, payload.url)) {
            sendDomainError(bp, data.id);
            break;
          }
          const popupState: Omit<PluginPopupState, 'open'> = {
            url: payload.url,
            title: payload.title ?? '',
            pluginId: bp.plugin.id,
            x: payload.mouseEvent?.clientX ?? 100,
            y: payload.mouseEvent?.clientY ?? 100,
          };
          if (payload.args !== undefined) {
            popupState.args = payload.args;
          }
          onOpenPopup?.(popupState);
          break;
        }
        case 'UI_CLOSE_POPUP':
          onClosePopup?.();
          break;
        case 'UI_SIZE_TO': {
          const payload = data.payload as { height: number };
          onSizeTo?.(payload.height);
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [findPluginByOrigin, handleDataGet, handleDataSet, handleCapabilityResponse, handleCtxQuery, isDomainAllowed, sendDomainError, onOpenModal, onCloseModal, onUpdateModal, onOpenPopup, onClosePopup, onSizeTo]);

  // Resolve a capability across all active plugins that have registered it
  const resolve = useCallback(
    (capability: string, context: CapabilityContext): Promise<unknown[]> => {
      const getEligible = (): BoardPlugin[] =>
        plugins.filter((bp) => {
          const state = pluginStateRef.current.get(bp.plugin.id);
          return state?.capabilities.includes(capability);
        });

      const getReadyCount = (): number =>
        plugins.filter((bp) => pluginStateRef.current.has(bp.plugin.id)).length;

      const invokeEligible = (eligible: BoardPlugin[]): Promise<unknown[]> => {
        return new Promise<unknown[]>((resolvePromise) => {
          const requestId = `cap-${Date.now()}-${Math.random()}`;
          pendingCapabilityRef.current.set(requestId, {
            resolve: resolvePromise,
            results: [],
            remaining: eligible.length,
          });

          for (const bp of eligible) {
            // Store context so CTX_* queries from this plugin can resolve it
            pluginContextRef.current.set(bp.plugin.id, context);
            sendToPlugin(bp.plugin.id, {
              jhSdk: true,
              id: requestId,
              type: 'CAPABILITY_INVOKE',
              payload: { capability, args: context, requestId },
            });
          }

          // Timeout: resolve with partial results after 3 s to avoid stale UI
          setTimeout(() => {
            const pending = pendingCapabilityRef.current.get(requestId);
            if (pending) {
              pending.resolve(pending.results);
              pendingCapabilityRef.current.delete(requestId);
            }
          }, 3000);
        });
      };

      const eligible = getEligible();
      if (eligible.length > 0) {
        return invokeEligible(eligible);
      }

      // WHY: on first render, card UI can resolve capabilities before hidden plugin
      // iframes send PLUGIN_READY; wait briefly so badges/buttons appear reliably.
      if (plugins.length === 0 || getReadyCount() === plugins.length) {
        return Promise.resolve([]);
      }

      return new Promise<unknown[]>((resolvePromise) => {
        const deadline = Date.now() + 1200;
        const retry = () => {
          const nextEligible = getEligible();
          if (nextEligible.length > 0) {
            void invokeEligible(nextEligible).then(resolvePromise);
            return;
          }

          if (getReadyCount() === plugins.length || Date.now() >= deadline) {
            resolvePromise([]);
            return;
          }

          globalThis.setTimeout(retry, 100);
        };

        retry();
      });
    },
    [plugins, sendToPlugin],
  );

  return { resolve, sendToPlugin };
}
