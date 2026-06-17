// Sprint 171 — card-chat session lifecycle: start, pause, resume, ensure-active.
import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import type {
  CardChatSession,
  CardChatSessionStatus,
  StartSessionInput,
  PauseSessionInput,
  ResumeSessionInput,
} from '../../types';

export const sessionLifecycleDeps = {
  db,
};

/**
 * Allowed transitions for the session state machine.
 * IDLE is an explicit state — sessions can be created in IDLE and transitioned
 * to ACTIVE_REFINEMENT via resume. PAUSED can also be resumed back to ACTIVE_REFINEMENT.
 */
const ALLOWED_TRANSITIONS: Record<CardChatSessionStatus, CardChatSessionStatus[]> = {
  IDLE: ['ACTIVE_REFINEMENT'],
  ACTIVE_REFINEMENT: ['PAUSED', 'READY_FOR_REVIEW'],
  PAUSED: ['ACTIVE_REFINEMENT'],
  READY_FOR_REVIEW: [], // terminal — no further transitions in this iteration
};

// [why] One active session per card — find by card_id + non-terminal status.
// IDLE sessions are also considered "findable" so resume can transition them to ACTIVE_REFINEMENT.
// [why] No longer used by startSession (which always creates new sessions),
// but kept for pause/resume/ensureActiveSession which need to find existing sessions.
async function findActiveSession(cardId: string): Promise<CardChatSession | null> {
  const row = await sessionLifecycleDeps
    .db('card_chat_sessions')
    .where({ card_id: cardId })
    .whereIn('status', ['IDLE', 'ACTIVE_REFINEMENT', 'PAUSED'])
    .orderBy('created_at', 'desc')
    .first();
  return (row as CardChatSession | undefined) ?? null;
}

/**
 * Start a new card-chat session.
 * [why] Always creates a fresh session — each AI Assist invocation
 * should be an independent conversation, not a continuation of
 * a previous session's history.
 */
export async function startSession({
  cardId,
  workspaceId,
  userId,
}: StartSessionInput): Promise<{ status: 201; data: { session: CardChatSession } }> {
  const now = new Date().toISOString();
  const sessionId = randomUUID();

  const session: CardChatSession = {
    id: sessionId,
    card_id: cardId,
    workspace_id: workspaceId,
    created_by: userId,
    status: 'ACTIVE_REFINEMENT',
    quality_score: null,
    last_actor_at: now,
    created_at: now,
    updated_at: now,
  };

  await sessionLifecycleDeps.db('card_chat_sessions').insert(session);

  return { status: 201, data: { session } };
}

/**
 * Pause a card-chat session.
 * Rejects if the session is already PAUSED or READY_FOR_REVIEW.
 */
export async function pauseSession({
  sessionId,
  cardId,
}: PauseSessionInput): Promise<
  | { status: 200; data: { session: CardChatSession } }
  | { status: 404; name: string; data: { message: string } }
  | { status: 409; name: string; data: { message: string } }
> {
  const session = (await sessionLifecycleDeps
    .db('card_chat_sessions')
    .where({ id: sessionId, card_id: cardId })
    .first()) as CardChatSession | undefined;

  if (!session) {
    return {
      status: 404,
      name: 'session-not-found',
      data: { message: 'No chat session found for this card' },
    };
  }

  if (session.status === 'PAUSED') {
    return {
      status: 409,
      name: 'session-already-paused',
      data: { message: 'Session is already paused' },
    };
  }

  if (session.status === 'READY_FOR_REVIEW') {
    return {
      status: 409,
      name: 'session-is-ready-for-review',
      data: { message: 'Cannot pause a session that is ready for review' },
    };
  }

  const now = new Date().toISOString();
  await sessionLifecycleDeps
    .db('card_chat_sessions')
    .where({ id: sessionId })
    .update({
      status: 'PAUSED',
      last_actor_at: now,
      updated_at: now,
    });

  const updated: CardChatSession = {
    ...session,
    status: 'PAUSED',
    last_actor_at: now,
    updated_at: now,
  };

  return { status: 200, data: { session: updated } };
}

/**
 * Resume a paused or idle session back to ACTIVE_REFINEMENT.
 * Rejects if the session is already ACTIVE_REFINEMENT or READY_FOR_REVIEW.
 */
export async function resumeSession({
  sessionId,
  cardId,
}: ResumeSessionInput): Promise<
  | { status: 200; data: { session: CardChatSession } }
  | { status: 404; name: string; data: { message: string } }
  | { status: 409; name: string; data: { message: string } }
> {
  const session = (await sessionLifecycleDeps
    .db('card_chat_sessions')
    .where({ id: sessionId, card_id: cardId })
    .first()) as CardChatSession | undefined;

  if (!session) {
    return {
      status: 404,
      name: 'session-not-found',
      data: { message: 'No chat session found for this card' },
    };
  }

  // [why] Already in the target state — not an error, just no-op.
  if (session.status === 'ACTIVE_REFINEMENT') {
    return { status: 200, data: { session } };
  }

  // [why] READY_FOR_REVIEW is terminal — cannot resume from it.
  if (session.status === 'READY_FOR_REVIEW') {
    return {
      status: 409,
      name: 'session-is-ready-for-review',
      data: { message: 'Cannot resume a session that is ready for review' },
    };
  }

  // Only IDLE and PAUSED can be resumed to ACTIVE_REFINEMENT.
  const now = new Date().toISOString();
  await sessionLifecycleDeps
    .db('card_chat_sessions')
    .where({ id: sessionId })
    .update({
      status: 'ACTIVE_REFINEMENT',
      last_actor_at: now,
      updated_at: now,
    });

  const updated: CardChatSession = {
    ...session,
    status: 'ACTIVE_REFINEMENT',
    last_actor_at: now,
    updated_at: now,
  };

  return { status: 200, data: { session: updated } };
}

/**
 * Ensure an active session exists for the card. If one already exists and is
 * not READY_FOR_REVIEW, resume it to ACTIVE_REFINEMENT. Otherwise create a new one.
 */
export async function ensureActiveSession({
  cardId,
  workspaceId,
  userId,
}: StartSessionInput): Promise<{ status: 201 | 200; data: { session: CardChatSession } }> {
  const existing = await findActiveSession(cardId);

  if (existing) {
    if (existing.status === 'ACTIVE_REFINEMENT') {
      return { status: 200, data: { session: existing } };
    }

    // Resume paused session back to ACTIVE_REFINEMENT
    const now = new Date().toISOString();
    await sessionLifecycleDeps
      .db('card_chat_sessions')
      .where({ id: existing.id })
      .update({
        status: 'ACTIVE_REFINEMENT',
        last_actor_at: now,
        updated_at: now,
      });

    const resumed: CardChatSession = {
      ...existing,
      status: 'ACTIVE_REFINEMENT',
      last_actor_at: now,
      updated_at: now,
    };

    return { status: 200, data: { session: resumed } };
  }

  return startSession({ cardId, workspaceId, userId });
}
