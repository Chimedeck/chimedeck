// POST /api/v1/cards/:cardId/chat/propose-description
// Sprint 171 — AI-generated card description proposal from chat history.
// The AI synthesizes the conversation into a structured card description
// and returns it for user confirmation before applying.
//
// [why] Auth and board visibility are already enforced by the cardChat router
// (applyBoardVisibilityFromCard). This handler only validates the request body
// and calls the AI provider — no redundant auth/membership checks.
import { requestCardChatCompletion } from '../../mods/provider';
import { db } from '../../../../common/db';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import type { CardChatMessage, CardChatProviderMessage } from '../../types';

export const proposeDescriptionDeps = {
  requestCardChatCompletion,
  db,
};

const PROPOSE_FORMAT_PROMPT = [
  'Based on the conversation above, act as a Technical Product Manager and write a highly detailed, developer-ready card description.',
  'Strictly use the following structure and sections:',
  '"JH DESCRIPTION:" to state the current limitation or problem.',
  '"→ What to update:" for a one-sentence summary of the new capability.',
  'Numbered sections for each screen (e.g., "1/ Listing page:") detailing exact UI/UX changes, button states, specific copy updates, and mock-up references.',
  '"IMPORTANT NOTE:" for edge cases, data persistence rules, out-of-scope items, and testing parameters.',
  'And "BREAKDOWN:" for a bulleted technical task list including function/variable suggestions, ending with Desktop and Mobile testing.',
  'Be specific and actionable. Use only information from the conversation, and format using Markdown (bolding, bullet points, and sparse emojis for highlights).'
].join(' ');

export async function handleProposeCardDescription(req: Request, cardId: string): Promise<Response> {
  // [why] Auth and board visibility are already enforced by the cardChat
  // router via applyBoardVisibilityFromCard. We only need to validate
  // the request body and call the AI provider.
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.currentUser?.id;
  if (!userId) {
    return Response.json(
      { name: 'unauthorized', data: { message: 'Authentication required' } },
      { status: 401 },
    );
  }

  let body: { sessionId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
      { status: 400 },
    );
  }

  if (typeof body.sessionId !== 'string' || body.sessionId === '') {
    return Response.json(
      { name: 'missing-session-id', data: { message: 'sessionId is required' } },
      { status: 400 },
    );
  }

  // Fetch card metadata for context
  const card = await proposeDescriptionDeps.db('cards')
    .where({ id: cardId })
    .select('id', 'title', 'description')
    .first();
  if (!card) {
    return Response.json(
      { name: 'card-not-found', data: { message: 'Card not found' } },
      { status: 404 },
    );
  }

  // Fetch conversation messages for the session
  const messages: CardChatMessage[] = await proposeDescriptionDeps.db('card_chat_messages')
    .where({ session_id: body.sessionId })
    .orderBy('created_at', 'asc')
    .select('*');

  if (messages.length === 0) {
    return Response.json(
      { name: 'no-messages', data: { message: 'No conversation messages found for this session' } },
      { status: 400 },
    );
  }

  // Build the AI prompt with conversation history
  // [why] Use a dedicated system prompt for description synthesis instead
  // of the BA persona prompt. The BA prompt says "Do NOT propose solutions"
  // which conflicts with asking the AI to synthesize a description.
  const systemPrompt = [
    'You are a technical writer assistant. Based on the conversation below,',
    'synthesize a clear, structured card description for this feature.',
    '',
    `Card title: ${card.title as string}`,
    `Current description: ${(card.description as string | null) ?? '(empty)'}`,
  ].join('\n');

  const providerMessages: CardChatProviderMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: PROPOSE_FORMAT_PROMPT },
  ];

  for (const msg of messages) {
    // [why] Tool-role messages are internal provider metadata, not part of
    // the user-visible conversation. Skip them when building the prompt.
    if (msg.role === 'tool') continue;
    providerMessages.push({ role: msg.role, content: msg.content });
  }

  try {
    const completion = await proposeDescriptionDeps.requestCardChatCompletion({
      messages: providerMessages,
    });

    if (completion.status !== 200 || !completion.data) {
      return Response.json(
        { name: completion.name ?? 'ai-provider-error', data: { message: completion.message ?? 'AI provider failed' } },
        { status: completion.status },
      );
    }

    return Response.json(
      {
        data: {
          proposedDescription: completion.data.message,
          sessionId: body.sessionId,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[cardChat/propose-description] Unexpected error:', error instanceof Error ? error.message : String(error));
    return Response.json(
      { name: 'internal-error', data: { message: 'Failed to generate description proposal' } },
      { status: 500 },
    );
  }
}
