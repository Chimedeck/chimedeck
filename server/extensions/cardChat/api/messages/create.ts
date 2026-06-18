// POST /api/v1/cards/:cardId/chat/messages
// Sprint 171 — persist card-chat messages and auto-generate AI response.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { writeCardChatMessage } from '../../mods/messages/write';
import { requestCardChatCompletion } from '../../mods/provider';
import { buildBAPersonaSystemPrompt } from '../../mods/baPersona';
import { db } from '../../../../common/db';
import type { CardChatMessageRole, CardChatMessage, CardChatProviderMessage } from '../../types';

export const cardChatCreateApiDeps = {
  authenticate,
  requireWorkspaceMembership,
  writeCardChatMessage,
  requestCardChatCompletion,
  db,
  buildBAPersonaSystemPrompt,
};

interface CardMeta {
  id: string;
  title: string;
  description: string | null;
}

interface ParsedMessageBody {
  sessionId: string;
  content: string;
  role: CardChatMessageRole;
}

/**
 * [why] Auto-generate an AI assistant response after a user message.
 * Fetches card context and conversation history, calls the AI provider,
 * and persists the assistant's reply. Best-effort — failures are logged
 * but don't block the user's message from being saved.
 */
async function generateAssistantReply(
  sessionId: string,
  cardId: string,
  authorId: string
): Promise<CardChatMessage | null> {
  const cardRow = (await cardChatCreateApiDeps
    .db('cards')
    .where({ id: cardId })
    .select('id', 'title', 'description')
    .first()) as { id: string; title: string; description: string | null } | undefined;
  const card: CardMeta = {
    id: (cardRow as { id: string } | undefined)?.id ?? cardId,
    title: (cardRow as { title: string } | undefined)?.title ?? 'Untitled',
    description: (cardRow as { description: string | null } | undefined)?.description ?? null,
  };

  const recentMessages = (await cardChatCreateApiDeps
    .db('card_chat_messages')
    .where({ session_id: sessionId })
    .orderBy('created_at', 'asc')
    .select('*')) as CardChatMessage[];

  // [why] Detect the PROPOSE_DESCRIPTION system message — the client sends
  // this when the user clicks "Propose". Use a description-synthesis prompt
  // instead of the BA persona follow-up question prompt.
  const lastMsg = recentMessages[recentMessages.length - 1];
  const isProposeRequest = lastMsg?.role === 'system' && lastMsg?.content === 'PROPOSE_DESCRIPTION';

  // [why] When proposing a description, use a technical-writer system prompt
  // instead of the BA persona prompt. The BA prompt says "Do NOT propose
  // solutions" which conflicts with asking the AI to synthesize a description.
  const systemPrompt = isProposeRequest
    ? [
        'You are a technical writer assistant. Based on the conversation below,',
        'synthesize a clear, structured card description for this feature.',
        '',
        `Card title: ${card.title}`,
        `Current description: ${card.description ?? '(empty)'}`,
      ].join('\n')
    : cardChatCreateApiDeps.buildBAPersonaSystemPrompt({
        cardTitle: card.title,
        cardDescription: card.description ?? '',
      });

  const instructionPrompt = isProposeRequest
    ? 'Based on the conversation above, write a clear, structured card description using Markdown with these sections: ## Summary, ## Requirements, ## Acceptance Criteria, ## Constraints & Assumptions. Be specific and actionable. Use only information from the conversation.'
    : "Respond to the user's latest message. Ask one focused follow-up question to help refine the requirement. Be conversational and encouraging. Keep your response under 200 words.";

  const providerMessages: CardChatProviderMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: instructionPrompt },
  ];

  for (const msg of recentMessages) {
    if (msg.role === 'tool') continue;
    // [why] Skip the PROPOSE_DESCRIPTION marker — it's an internal signal,
    // not part of the user-visible conversation.
    if (msg.role === 'system' && msg.content === 'PROPOSE_DESCRIPTION') continue;
    providerMessages.push({ role: msg.role, content: msg.content });
  }

  const completion = await cardChatCreateApiDeps.requestCardChatCompletion({
    messages: providerMessages,
  });

  if (completion.status !== 200 || !completion.data) return null;

  const aiResult = await cardChatCreateApiDeps.writeCardChatMessage({
    sessionId,
    cardId,
    authorId,
    role: 'assistant',
    content: completion.data.message,
  });
  return aiResult.data.message;
}

/**
 * [why] Parse and validate the request body for message creation.
 * Returns a structured result so the main handler stays lean.
 */
function parseMessageBody(raw: unknown): ParsedMessageBody | { error: Response } {
  if (typeof raw !== 'object' || raw === null) {
    return {
      error: Response.json(
        { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
        { status: 400 }
      ),
    };
  }
  const body = raw as Record<string, unknown>;

  if (typeof body.sessionId !== 'string' || body.sessionId === '') {
    return {
      error: Response.json(
        { name: 'missing-session-id', data: { message: 'sessionId is required' } },
        { status: 400 }
      ),
    };
  }

  if (typeof body.content !== 'string') {
    return {
      error: Response.json(
        { name: 'invalid-content', data: { message: 'content must be a string' } },
        { status: 400 }
      ),
    };
  }

  const trimmedContent = body.content.trim();
  if (trimmedContent === '') {
    return {
      error: Response.json(
        { name: 'missing-content', data: { message: 'content is required' } },
        { status: 400 }
      ),
    };
  }

  const role: CardChatMessageRole =
    body.role === 'assistant' || body.role === 'system' || body.role === 'tool'
      ? (body.role as CardChatMessageRole)
      : 'user';

  return { sessionId: body.sessionId, content: trimmedContent, role };
}

/**
 * [why] Map known write errors to structured API responses.
 * Keeps the main handler lean by extracting error classification.
 */
function mapWriteError(error: unknown): Response | null {
  const message = error instanceof Error ? error.message : 'unknown-error';
  if (message === 'card-chat-session-not-found') {
    return Response.json(
      { name: 'session-not-found', data: { message: 'Chat session not found for this card' } },
      { status: 404 }
    );
  }
  if (message === 'card-chat-session-not-active') {
    return Response.json(
      {
        name: 'session-is-paused',
        data: { message: 'Cannot write messages while the session is paused' },
      },
      { status: 409 }
    );
  }
  return null;
}

export async function handleCreateCardChatMessage(req: Request, cardId: string): Promise<Response> {
  const authError = await cardChatCreateApiDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const authReq = req as AuthenticatedRequest;
  const workspaceReq = req as WorkspaceScopedRequest;

  const membershipError = await cardChatCreateApiDeps.requireWorkspaceMembership(
    workspaceReq,
    workspaceReq.workspaceId ?? ''
  );
  if (membershipError) return membershipError;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
      { status: 400 }
    );
  }

  const parsed = parseMessageBody(rawBody);
  if ('error' in parsed) return parsed.error;

  const userId = authReq.currentUser?.id;
  if (!userId) {
    return Response.json(
      { name: 'unauthorized', data: { message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const result = await cardChatCreateApiDeps.writeCardChatMessage({
      sessionId: parsed.sessionId,
      cardId,
      authorId: userId,
      role: parsed.role,
      content: parsed.content,
    });

    const userMessage = result.data.message;

    let assistantMessage: CardChatMessage | null = null;
    try {
      assistantMessage = await generateAssistantReply(parsed.sessionId, cardId, userId);
    } catch (aiError) {
      console.error(
        '[cardChat/create] AI auto-reply failed:',
        aiError instanceof Error ? aiError.message : String(aiError)
      );
    }

    return Response.json(
      {
        data: {
          userMessage,
          ...(assistantMessage ? { assistantMessage } : {}),
        },
      },
      { status: result.status }
    );
  } catch (error) {
    const mapped = mapWriteError(error);
    if (mapped) return mapped;
    throw error;
  }
}
