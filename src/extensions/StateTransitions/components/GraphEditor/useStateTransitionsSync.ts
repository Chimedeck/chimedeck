import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import { socket, type RealtimeEvent } from '~/extensions/Realtime/client/socket';
import { selectAccessToken, selectCurrentUser } from '~/slices/authSlice';
import { selectStateTransitionsEnabled } from '~/slices/featureFlagsSlice';
import {
  type StateTransitionGraph,
  invalidateStateTransitionsBoardCache,
  useGetStateTransitionsQuery,
  usePutStateTransitionsMutation,
} from '../../api';

interface Args {
  boardId: string;
  active: boolean;
}

interface PersistInput {
  enabled: boolean;
  graph: StateTransitionGraph;
}

interface RemoteStateTransitionUpdate {
  id: number;
  enabled: boolean;
  graph: StateTransitionGraph;
}

const REMOTE_NODE_GRACE_PERIOD_MS = 500;

export function shouldIgnoreStateTransitionEcho({
  actorId,
  currentUserId,
}: {
  actorId: string | undefined;
  currentUserId: string | null | undefined;
}): boolean {
  if (!actorId) return false;
  if (!currentUserId) return false;
  return actorId === currentUserId;
}

export function applyRemoteGraphMerge({
  localGraph,
  remoteGraph,
  recentLocalNodeIds,
}: {
  localGraph: StateTransitionGraph;
  remoteGraph: StateTransitionGraph;
  recentLocalNodeIds: Set<string>;
}): StateTransitionGraph {
  const remoteNodeIds = new Set(remoteGraph.nodes.map((node) => node.id));
  const preservedLocalNodes = localGraph.nodes.filter(
    (node) => recentLocalNodeIds.has(node.id) && !remoteNodeIds.has(node.id)
  );

  return {
    nodes: [...remoteGraph.nodes, ...preservedLocalNodes],
    // [why] LWW for edges/notes keeps all tabs convergent on authoritative state.
    edges: remoteGraph.edges,
    notes: remoteGraph.notes,
  };
}

async function fetchPresenceUserIds({
  boardId,
  accessToken,
}: {
  boardId: string;
  accessToken: string | null;
}): Promise<Set<string>> {
  const requestInit: RequestInit = { credentials: 'include' };
  if (accessToken) {
    requestInit.headers = { Authorization: `Bearer ${accessToken}` };
  }

  const response = await fetch(`/api/v1/boards/${boardId}/presence`, requestInit);
  if (!response.ok) {
    return new Set();
  }

  const payload = (await response.json()) as { data?: Array<{ id?: string }> };
  const ids = new Set<string>();
  for (const user of payload.data ?? []) {
    if (typeof user.id === 'string' && user.id.length > 0) ids.add(user.id);
  }
  return ids;
}

function getErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'Unknown error';
  const maybeError = error as { data?: { data?: { message?: string } } };
  return maybeError.data?.data?.message ?? 'Failed to save state transitions';
}

export const useStateTransitionsSync = ({ boardId, active }: Args) => {
  const dispatch = useAppDispatch();
  const isFeatureEnabled = useAppSelector(selectStateTransitionsEnabled);
  const currentUser = useAppSelector(selectCurrentUser);
  const accessToken = useAppSelector(selectAccessToken);
  const shouldSkip = !active || !isFeatureEnabled || boardId.length === 0;
  const recentLocalNodeIdsRef = useRef<Map<string, number>>(new Map());
  const knownNodeIdsRef = useRef<Set<string>>(new Set());
  const remoteUpdateIdRef = useRef(0);
  const [presenceUserIds, setPresenceUserIds] = useState<Set<string>>(new Set());
  const [remoteUpdate, setRemoteUpdate] = useState<RemoteStateTransitionUpdate | null>(null);

  const { data, isFetching, isLoading, isError, error } = useGetStateTransitionsQuery(boardId, {
    skip: shouldSkip,
  });

  const [putStateTransitions, putStatus] = usePutStateTransitionsMutation();

  const persistTransitions = useCallback(
    async ({ enabled, graph }: PersistInput) => {
      const now = Date.now();
      for (const node of graph.nodes) {
        if (!knownNodeIdsRef.current.has(node.id) && !recentLocalNodeIdsRef.current.has(node.id)) {
          recentLocalNodeIdsRef.current.set(node.id, now);
        }
      }
      await putStateTransitions({
        boardId,
        enabled,
        graph,
      }).unwrap();
      knownNodeIdsRef.current = new Set(graph.nodes.map((node) => node.id));
    },
    [boardId, putStateTransitions]
  );

  useEffect(() => {
    knownNodeIdsRef.current = new Set((data?.graph.nodes ?? []).map((node) => node.id));
  }, [data?.graph.nodes]);

  useEffect(() => {
    if (shouldSkip) return;
    let cancelled = false;
    void fetchPresenceUserIds({ boardId, accessToken }).then((next) => {
      if (cancelled) return;
      setPresenceUserIds(next);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, boardId, shouldSkip]);

  useEffect(() => {
    if (shouldSkip) return;

    const unsubscribe = socket.subscribe({
      onEvent(event: RealtimeEvent) {
        if (event.board_id && event.board_id !== boardId) return;

        if (event.type === 'presence_update') {
          const eventPayload =
            typeof event.payload === 'object' && event.payload !== null
              ? (event.payload as { user?: { userId?: string }; action?: 'join' | 'leave' })
              : (event as unknown as { user?: { userId?: string }; action?: 'join' | 'leave' });
          const userId = eventPayload.user?.userId;
          if (!userId) return;
          setPresenceUserIds((current) => {
            const next = new Set(current);
            if (eventPayload.action === 'leave') {
              next.delete(userId);
            } else {
              next.add(userId);
            }
            return next;
          });
          return;
        }

        if (event.type !== 'state_transition_updated') return;
        const wsEvent = event as RealtimeEvent & {
          actor_id?: string;
          payload?: { enabled?: unknown; graph?: unknown };
        };
        if (
          shouldIgnoreStateTransitionEcho({
            actorId: wsEvent.actor_id,
            currentUserId: currentUser?.id ?? null,
          })
        ) {
          return;
        }

        const payload = wsEvent.payload;
        if (
          !payload ||
          typeof payload.enabled !== 'boolean' ||
          typeof payload.graph !== 'object' ||
          payload.graph === null
        ) {
          return;
        }

        invalidateStateTransitionsBoardCache(dispatch, boardId);
        remoteUpdateIdRef.current += 1;
        setRemoteUpdate({
          id: remoteUpdateIdRef.current,
          enabled: payload.enabled,
          graph: payload.graph as StateTransitionGraph,
        });
      },
    });
    return unsubscribe;
  }, [boardId, currentUser?.id, dispatch, shouldSkip]);

  const activeEditorCount = useMemo(() => {
    const baseCount = presenceUserIds.size;
    if (!currentUser?.id) return baseCount;
    if (baseCount > 0) return baseCount;
    return shouldSkip ? 0 : 1;
  }, [currentUser?.id, presenceUserIds, shouldSkip]);

  const clearRemoteUpdate = useCallback(() => {
    setRemoteUpdate(null);
  }, []);

  const consumeRecentLocalNodeIds = useCallback(() => {
    const now = Date.now();
    const recent = new Set<string>();
    for (const [nodeId, createdAt] of recentLocalNodeIdsRef.current.entries()) {
      if (now - createdAt <= REMOTE_NODE_GRACE_PERIOD_MS) {
        recent.add(nodeId);
        continue;
      }
      recentLocalNodeIdsRef.current.delete(nodeId);
    }
    return recent;
  }, []);

  return {
    isFeatureEnabled,
    transitions: data,
    // [why] Keep canvas mounted during background revalidation to avoid visual
    // flicker/bleep after local saves (edge create/update).
    // Only show blocking loading state for the initial fetch when no data exists yet.
    isLoading: isLoading || (!data && isFetching),
    isSaving: putStatus.isLoading,
    isError,
    errorMessage: isError ? getErrorMessage(error) : null,
    activeEditorCount,
    remoteUpdate,
    clearRemoteUpdate,
    consumeRecentLocalNodeIds,
    persistTransitions,
  };
};
