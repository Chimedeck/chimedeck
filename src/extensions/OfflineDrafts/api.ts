// Client API wrapper for server-side draft endpoints.
// WHY: centralises all server communication for drafts so the rest of the
// client can call typed functions instead of raw fetch() calls. All endpoints
// require a Bearer token — callers must pass the current user's access token.
//
// Endpoints proxied:
//   GET    /api/v1/cards/:cardId/drafts
//   PUT    /api/v1/cards/:cardId/drafts/:type
//   DELETE /api/v1/cards/:cardId/drafts/:type

import type { DraftType, DraftIntent } from './storage';

export interface ServerDraft {
  id: string;
  card_id: string;
  draft_type: DraftType;
  content_markdown: string;
  intent: DraftIntent;
  client_updated_at: string;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertDraftPayload {
  content_markdown: string;
  intent: DraftIntent;
  /** ISO-8601 timestamp of when the client last modified the draft. */
  client_updated_at: string;
}

// ---------- Internal helpers ----------

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = { name: 'unexpected-error', data: { status: res.status } };
    }
    throw errorBody;
  }
  return res.json() as Promise<T>;
}

// ---------- Public API ----------

/**
 * List all server-side drafts for the current user on a card.
 * Returns an empty array when no drafts exist.
 */
export async function listServerDrafts({
  cardId,
  token,
}: {
  cardId: string;
  token: string;
}): Promise<ServerDraft[]> {
  const res = await fetch(`/api/v1/cards/${cardId}/drafts`, {
    headers: authHeaders(token),
  });
  const body = await handleResponse<{ data: ServerDraft[] }>(res);
  return body.data;
}

/**
 * Upsert a draft on the server (creates or updates the row for this user + card + type).
 * Returns the persisted draft row including server-assigned `synced_at`.
 */
export async function upsertServerDraft({
  cardId,
  draftType,
  payload,
  token,
}: {
  cardId: string;
  draftType: DraftType;
  payload: UpsertDraftPayload;
  token: string;
}): Promise<ServerDraft> {
  const res = await fetch(`/api/v1/cards/${cardId}/drafts/${draftType}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await handleResponse<{ data: ServerDraft }>(res);
  return body.data;
}

/**
 * Delete a draft from the server.
 * Resolves successfully when the draft is deleted or was already absent (404 is re-thrown
 * so callers can distinguish between "not found" and other errors if needed).
 */
export async function deleteServerDraft({
  cardId,
  draftType,
  token,
}: {
  cardId: string;
  draftType: DraftType;
  token: string;
}): Promise<void> {
  const res = await fetch(`/api/v1/cards/${cardId}/drafts/${draftType}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await handleResponse<{ data: Record<string, never> }>(res);
}
