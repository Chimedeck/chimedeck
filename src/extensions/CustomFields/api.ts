// Custom Fields API client — plain async functions over apiClient, plus lightweight
// React hooks (useState/useEffect) following the established project pattern.
// [why] The project uses plain async thunks rather than RTK Query; hooks are
//       provided here so components don't need separate duck files for simple reads.
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '~/common/api/client';
import type {
  CustomField,
  CustomFieldValue,
  CreateCustomFieldPayload,
  UpdateCustomFieldPayload,
  UpsertCardFieldValuePayload,
} from './types';

// Re-export types so consumers can import from the single entry point.
export type { CustomField, CustomFieldValue } from './types';

// ─── Field Definition API ────────────────────────────────────────────────────

type Api = typeof apiClient;

export async function listCustomFields({
  api,
  boardId,
}: {
  api: Api;
  boardId: string;
}): Promise<{ data: CustomField[] }> {
  return api.get(`/boards/${boardId}/custom-fields`);
}

export async function createCustomField({
  api,
  boardId,
  payload,
}: {
  api: Api;
  boardId: string;
  payload: CreateCustomFieldPayload;
}): Promise<{ data: CustomField }> {
  return api.post(`/boards/${boardId}/custom-fields`, payload);
}

export async function updateCustomField({
  api,
  boardId,
  fieldId,
  payload,
}: {
  api: Api;
  boardId: string;
  fieldId: string;
  payload: UpdateCustomFieldPayload;
}): Promise<{ data: CustomField }> {
  return api.patch(`/boards/${boardId}/custom-fields/${fieldId}`, payload);
}

export async function deleteCustomField({
  api,
  boardId,
  fieldId,
}: {
  api: Api;
  boardId: string;
  fieldId: string;
}): Promise<void> {
  return api.delete(`/boards/${boardId}/custom-fields/${fieldId}`);
}

// ─── Card Value API ───────────────────────────────────────────────────────────

export async function upsertCardFieldValue({
  api,
  cardId,
  fieldId,
  payload,
}: {
  api: Api;
  cardId: string;
  fieldId: string;
  payload: UpsertCardFieldValuePayload;
}): Promise<{ data: CustomFieldValue }> {
  return api.put(`/cards/${cardId}/custom-field-values/${fieldId}`, payload);
}

export async function deleteCardFieldValue({
  api,
  cardId,
  fieldId,
}: {
  api: Api;
  cardId: string;
  fieldId: string;
}): Promise<void> {
  return api.delete(`/cards/${cardId}/custom-field-values/${fieldId}`);
}

// ─── Board-level Batch Card Values Cache ─────────────────────────────────────
// [why] On a board page every card tile needs its custom field values. Without
//       batching, each CardCustomFieldBadges fires one request → N requests for
//       N cards. The batch fetch hits a single endpoint returning values for
//       all requested cards, then stores them in a per-board map for lookups.

const BATCH_CF_TTL_MS = 30_000;

const _batchCfCache = new Map<string, { data: Record<string, CustomFieldValue[]>; expiresAt: number }>();
const _batchCfInflight = new Map<string, Promise<Record<string, CustomFieldValue[]>>>();
const _batchCfInvalidationListeners = new Map<string, Set<() => void>>();

function _subscribeBoardCardFieldValuesInvalidation(boardId: string, listener: () => void): () => void {
  const listeners = _batchCfInvalidationListeners.get(boardId) ?? new Set<() => void>();
  listeners.add(listener);
  _batchCfInvalidationListeners.set(boardId, listeners);

  return () => {
    const current = _batchCfInvalidationListeners.get(boardId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) _batchCfInvalidationListeners.delete(boardId);
  };
}

function _notifyBoardCardFieldValuesInvalidated(boardId: string): void {
  const listeners = _batchCfInvalidationListeners.get(boardId);
  if (!listeners) return;
  for (const listener of listeners) listener();
}

export function invalidateBoardCardFieldValuesCache(boardId: string): void {
  _batchCfCache.delete(boardId);
  _batchCfInflight.delete(boardId);
  _notifyBoardCardFieldValuesInvalidated(boardId);
}

function _fetchBoardCardFieldValues(
  boardId: string,
  cardIds: string[],
): Promise<Record<string, CustomFieldValue[]>> {
  const cached = _batchCfCache.get(boardId);
  if (cached && Date.now() < cached.expiresAt) return Promise.resolve(cached.data);

  const inflight = _batchCfInflight.get(boardId);
  if (inflight) return inflight;

  const promise = apiClient
    .post<{ data: CustomFieldValue[] }>(`/boards/${boardId}/custom-field-values`, {
      cardIds,
    })
    .catch((err) => {
      // Backward compatibility for older servers that only support GET with query string.
      const qs = cardIds.join(',');
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 405) {
        return apiClient.get<{ data: CustomFieldValue[] }>(`/boards/${boardId}/custom-field-values?cardIds=${qs}`);
      }
      throw err;
    })
    .then((res) => {
      const flat = (res as unknown as { data: CustomFieldValue[] }).data ?? [];
      const map: Record<string, CustomFieldValue[]> = {};
      for (const v of flat) {
        const arr = map[v.card_id] ?? [];
        map[v.card_id] = arr;
        arr.push(v);
      }
      _batchCfCache.set(boardId, { data: map, expiresAt: Date.now() + BATCH_CF_TTL_MS });
      _batchCfInflight.delete(boardId);
      return map;
    })
    .catch((err) => {
      _batchCfInflight.delete(boardId);
      throw err;
    });

  _batchCfInflight.set(boardId, promise);
  return promise;
}

/**
 * Fetch custom field values for all cards on a board in a single request.
 * Returns a stable map `{ [cardId]: CustomFieldValue[] }`.
 * The cardIdsKey param is used only to re-trigger when the set of cards changes.
 */
export function useBoardCardFieldValues(
  boardId: string | undefined,
  cardIds: string[],
): Record<string, CustomFieldValue[]> | null {
  // [why] null = not yet fetched; {} = fetched but no values. This distinction
  //       lets consumers skip the per-card fallback hook while loading.
  const [valuesMap, setValuesMap] = useState<Record<string, CustomFieldValue[]> | null>(null);
  const [tick, setTick] = useState(0);
  // [why] Serialize cardIds to a string so useEffect can detect actual set changes
  //       without needing a stable array reference.
  const cardIdsKey = cardIds.slice().sort((a, b) => a.localeCompare(b)).join(',');

  useEffect(() => {
    if (!boardId) return;
    return _subscribeBoardCardFieldValuesInvalidation(boardId, () => {
      setTick((t) => t + 1);
    });
  }, [boardId]);

  useEffect(() => {
    if (!boardId || cardIds.length === 0) return;
    let cancelled = false;
    _fetchBoardCardFieldValues(boardId, cardIds)
      .then((map) => { if (!cancelled) setValuesMap(map); })
      .catch(() => { /* silently degrade — card badges just won't show */ });
    return () => { cancelled = true; };
  }, [boardId, cardIdsKey, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return valuesMap;
}

// ─── Custom Fields Request Cache ─────────────────────────────────────────────
// [why] Multiple components on the same board page (e.g. CardModal per card,
//       BoardCustomFieldsPanel) all call useCustomFields(boardId). Without
//       deduplication every mount fires a separate HTTP request, effectively
//       DDoSing the server when a board has many cards open. The cache here:
//   1. Deduplicates concurrent in-flight requests (all callers share 1 promise)
//   2. Re-uses the result for CACHE_TTL_MS so remounts don't re-fetch needlessly

const CACHE_TTL_MS = 30_000; // 30 s — fresh enough for UI, prevents request storms

const _cfCache = new Map<string, { data: CustomField[]; expiresAt: number }>();
const _cfInflight = new Map<string, Promise<CustomField[]>>();
const _cfInvalidationListeners = new Map<string, Set<() => void>>();

function _subscribeCustomFieldsInvalidation(boardId: string, listener: () => void): () => void {
  const listeners = _cfInvalidationListeners.get(boardId) ?? new Set<() => void>();
  listeners.add(listener);
  _cfInvalidationListeners.set(boardId, listeners);

  return () => {
    const current = _cfInvalidationListeners.get(boardId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) _cfInvalidationListeners.delete(boardId);
  };
}

function _notifyCustomFieldsInvalidated(boardId: string): void {
  const listeners = _cfInvalidationListeners.get(boardId);
  if (!listeners) return;
  for (const listener of listeners) listener();
}

function _fetchCustomFields(boardId: string): Promise<CustomField[]> {
  const cached = _cfCache.get(boardId);
  if (cached && Date.now() < cached.expiresAt) {
    return Promise.resolve(cached.data);
  }

  const inflight = _cfInflight.get(boardId);
  if (inflight) return inflight;

  const promise = listCustomFields({ api: apiClient, boardId })
    .then((res) => {
      _cfCache.set(boardId, { data: res.data, expiresAt: Date.now() + CACHE_TTL_MS });
      _cfInflight.delete(boardId);
      return res.data;
    })
    .catch((err) => {
      _cfInflight.delete(boardId);
      throw err;
    });

  _cfInflight.set(boardId, promise);
  return promise;
}

/** Bust the in-memory cache for a board — call after any mutation. */
export function invalidateCustomFieldsCache(boardId: string): void {
  _cfCache.delete(boardId);
  _cfInflight.delete(boardId);
  _notifyCustomFieldsInvalidated(boardId);
}

// ─── React Hooks ─────────────────────────────────────────────────────────────

interface UseCustomFieldsResult {
  fields: CustomField[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Fetch and subscribe to the custom field definitions for a board. */
export function useCustomFields(boardId: string | undefined): UseCustomFieldsResult {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Bust cache so all mounted consumers on this board refetch fresh data.
  const refetch = useCallback(() => {
    if (boardId) invalidateCustomFieldsCache(boardId);
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;
    return _subscribeCustomFieldsInvalidation(boardId, () => {
      setTick((t) => t + 1);
    });
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    _fetchCustomFields(boardId)
      .then((data) => {
        if (!cancelled) setFields(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error)?.message ?? 'Failed to load custom fields');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [boardId, tick]);

  return { fields, loading, error, refetch };
}

// ─── Card Custom Field Values Hook ───────────────────────────────────────────

interface UseCardCustomFieldValuesResult {
  values: CustomFieldValue[];
  loading: boolean;
  refetch: () => void;
  setValues: (values: CustomFieldValue[]) => void;
}

/**
 * Fetch all custom field values for a single card.
 * Values are fetched from GET /cards/:id/custom-field-values (all at once).
 * The setValues helper lets callers update local state after upsert without
 * triggering a full refetch.
 */
export function useCardCustomFieldValues(cardId: string | undefined): UseCardCustomFieldValuesResult {
  const [values, setValues] = useState<CustomFieldValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!cardId) return;
    let cancelled = false;
    setLoading(true);
    apiClient
      .get<{ data: CustomFieldValue[] }>(`/cards/${cardId}/custom-field-values`)
      .then((res) => {
        if (!cancelled) setValues((res as unknown as { data: CustomFieldValue[] }).data ?? []);
      })
      .catch(() => {
        if (!cancelled) setValues([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cardId, tick]);

  return { values, loading, refetch, setValues };
}
