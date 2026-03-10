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
export type { CustomField, CustomFieldValue };

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

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listCustomFields({ api: apiClient, boardId })
      .then((res) => {
        if (!cancelled) setFields(res.data);
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
