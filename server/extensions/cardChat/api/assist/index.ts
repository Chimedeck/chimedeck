// POST /api/v1/cards/:cardId/chat/assist
// Sprint 208 — AI assist for card chat with tool-use loop.
// The AI can call write_card_description to propose a description update,
// and read_attachments to read files attached to the card.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { db } from '../../../../common/db';
import { requestCardChatCompletion } from '../../mods/provider';
import { writeCardChatMessage } from '../../mods/messages/write';
import {
  broadcastCardChatProgress,
  type CardChatAssistActionCard,
} from '../../mods/realtime/broadcast';
import { readAttachments, READ_ATTACHMENTS_TOOL } from '../../mods/assist/readAttachments';
import type {
  CardChatMessage,
  CardChatProviderMessage,
  CardChatAssistContentPart,
  CardChatAssistOutput,
  CardChatAssistToolDefinition,
} from '../../types';

const MAX_TOOL_ITERATIONS = 4;

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface AssistToolResult {
  message?: string;
  actionCard?: CardChatAssistActionCard;
  // [why] Multimodal content parts (images, text files) from card attachments.
  // Carried alongside the message so the tool loop can inject them as a
  // follow-up user message for vision-capable providers.
  contentParts?: CardChatAssistContentPart[] | undefined;
}

export const cardChatAssistDeps = {
  authenticate,
  requireWorkspaceMembership,
  db,
  requestCardChatCompletion,
  writeCardChatMessage,
  broadcastCardChatProgress,
};

/**
 * Build the system prompt for the card-chat assist tool-use loop.
 * [why] The AI needs to know it can write to the card description
 * and should use the conversation context to synthesize a proposal.
 */
function buildAssistSystemPrompt(cardTitle: string, cardDescription: string | null): string {
  const descSnippet = cardDescription ? cardDescription.slice(0, 500) : '(empty)';
  return [
    'You are an AI assistant helping a user refine a card in a project management tool.',
    '',
    `Current card title: "${cardTitle}"`,
    `Current card description: "${descSnippet}"`,
    '',
    'You have access to the following tools:',
    '- write_card_description: Propose an updated card description based on the conversation. The proposal will be shown to the user for confirmation before being applied. Use this when the user asks you to write, update, or improve the card description, or when the conversation has produced enough detail to synthesize a clear description.',
    '- read_attachments: Read file attachments from the current card. Use this when the user asks to read files attached to the card, or when you need to understand the contents of attached files to better answer the user\'s questions. Provide the card_id and optionally a list of file_names. If file_names is omitted, the 3 latest readable files are fetched automatically.',
    '',
    'Guidelines:',
    '- When the user asks you to "write to the card" or "update the description", call write_card_description with a well-structured Markdown description.',
    'Strictly use the following structure and sections:',
    '"JH DESCRIPTION:" to state the current limitation or problem.',
    '"→ What to update:" for a one-sentence summary of the new capability.',
    'Numbered sections for each screen (e.g., "1/ Listing page:") detailing exact UI/UX changes, button states, specific copy updates, and mock-up references.',
    '"IMPORTANT NOTE:" for edge cases, data persistence rules, out-of-scope items, and testing parameters.',
    'And "BREAKDOWN:" for a bulleted technical task list including function/variable suggestions, ending with Desktop and Mobile testing.',
    'Be specific and actionable. Use only information from the conversation, and format using Markdown (bolding, bullet points, and sparse emojis for highlights).',
    '- If the user asks about files or attachments on the card, call read_attachments to fetch them. After reading, incorporate the file contents into your response.',
    '- If the user just wants to chat or ask questions, respond conversationally without calling tools.',
    '- Keep conversational responses under 200 words.',
  ].join('\n');
}

/**
 * Build the tool definitions for the LLM.
 */
function buildAssistTools(): CardChatAssistToolDefinition[] {
  return [
    {
      type: 'function' as const,
      function: {
        name: 'write_card_description',
        description:
          'Propose an updated card description based on the conversation. The proposal will be shown to the user for confirmation before being applied to the card.',
        parameters: {
          type: 'object' as const,
          properties: {
            description: {
              type: 'string',
              description:
                'The proposed card description in Markdown format with sections: ## Summary, ## Requirements, ## Acceptance Criteria, ## Constraints & Assumptions.',
            },
            summary: {
              type: 'string',
              description: 'A one-line summary of what changed (shown in the confirmation UI).',
            },
          },
          required: ['description'],
        },
      },
    },
    READ_ATTACHMENTS_TOOL,
  ];
}

/**
 * Execute a single tool call and return the result.
 */
async function executeToolCall(
  toolCall: ToolCall,
  cardId: string,
  workspaceId: string,
  sessionId: string,
  model: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
): Promise<AssistToolResult> {
  if (toolCall.function.name === 'write_card_description') {
    let args: { description?: string; summary?: string };
    try {
      args = JSON.parse(toolCall.function.arguments) as typeof args;
    } catch {
      return { message: 'Error: invalid tool arguments' };
    }

    if (!args.description || typeof args.description !== 'string') {
      return { message: 'Error: description is required for write_card_description' };
    }

    const idempotencyKey = `${toolCall.id}-${Date.now()}`;
    const actionCard: CardChatAssistActionCard = {
      state: 'suggested',
      toolName: 'write_card_description',
      toolCallId: toolCall.id,
      idempotencyKey,
      source: 'card-chat-assist',
      cardId,
      workspaceId,
      descriptionContent: args.description,
      descriptionPreview: args.summary ?? 'AI proposed a description update',
    };

    return {
      message: `Proposed description update for the card.`,
      actionCard,
    };
  }

  if (toolCall.function.name === 'read_attachments') {
    const result: CardChatAssistOutput = await readAttachments({
      cardId,
      toolCall: {
        id: toolCall.id,
        type: 'function',
        function: { name: toolCall.function.name, arguments: toolCall.function.arguments },
      },
      model,
      ...(usage ? { usage } : {}),
    });

    if (result.status !== 200) {
      return { message: result.message ?? 'Failed to read attachments' };
    }

    return {
      message: result.data?.message ?? 'Attachments read successfully',
      contentParts: result.data?.contentParts,
    };
  }

  return { message: `Unknown tool: ${toolCall.function.name}` };
}

/**
 * [why] Fetch the board_id for a card so we can broadcast progress
 * to the correct WebSocket room.
 */
async function getBoardIdForCard(cardId: string): Promise<string | null> {
  const row = await db('cards')
    .join('lists', 'cards.list_id', 'lists.id')
    .where('cards.id', cardId)
    .select('lists.board_id')
    .first();
  return (row as { board_id: string } | undefined)?.board_id ?? null;
}

export async function handleCardChatAssist(req: Request, cardId: string): Promise<Response> {
  const authError = await cardChatAssistDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const authReq = req as AuthenticatedRequest;
  const workspaceReq = req as WorkspaceScopedRequest;

  const membershipError = await cardChatAssistDeps.requireWorkspaceMembership(
    workspaceReq,
    workspaceReq.workspaceId ?? ''
  );
  if (membershipError) return membershipError;

  let body: { sessionId?: string; prompt?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'invalid-request-body', message: 'Request body must be JSON' } },
      { status: 400 }
    );
  }

  if (typeof body.sessionId !== 'string' || body.sessionId === '') {
    return Response.json(
      { error: { code: 'missing-session-id', message: 'sessionId is required' } },
      { status: 400 }
    );
  }

  if (typeof body.prompt !== 'string' || body.prompt.trim() === '') {
    return Response.json(
      { error: { code: 'missing-prompt', message: 'prompt is required' } },
      { status: 400 }
    );
  }

  const sessionId = body.sessionId;
  const prompt = body.prompt.trim();
  const userId = authReq.currentUser!.id;
  const workspaceId = workspaceReq.workspaceId ?? '';

  // [why] Wrap the entire assist logic in try/catch so thrown exceptions
  // (DB failures, provider timeouts) return a structured error to the client
  // instead of silently hanging.
  try {
    // Fetch card context
    const cardRow = (await cardChatAssistDeps
      .db('cards')
      .where({ id: cardId })
      .select('id', 'title', 'description')
      .first()) as { id: string; title: string; description: string | null } | undefined;
    const cardTitle = cardRow?.title ?? 'Untitled';
    const cardDescription = cardRow?.description ?? null;

    // Fetch conversation history
    const recentMessages = (await cardChatAssistDeps
      .db('card_chat_messages')
      .where({ session_id: sessionId })
      .orderBy('created_at', 'asc')
      .select('*')) as CardChatMessage[];

    // Get board_id for broadcasting
    const boardId = await getBoardIdForCard(cardId);

    // Build conversation for the LLM
    const systemPrompt = buildAssistSystemPrompt(cardTitle, cardDescription);
    const tools = buildAssistTools();

    const conversation: CardChatProviderMessage[] = [{ role: 'system', content: systemPrompt }];

    // Add conversation history (skip tool/system marker messages)
    for (const msg of recentMessages) {
      if (msg.role === 'tool') continue;
      if (msg.role === 'system' && msg.content === 'PROPOSE_DESCRIPTION') continue;
      conversation.push({ role: msg.role, content: msg.content });
    }

    // Add the user's prompt
    conversation.push({ role: 'user', content: prompt });

    // Persist the user message
    const userMessage = await cardChatAssistDeps.writeCardChatMessage({
      sessionId,
      cardId,
      authorId: userId,
      role: 'user',
      content: prompt,
    });

    // Multi-turn tool-use loop
    const allActionCards: CardChatAssistActionCard[] = [];
    let finalMessage: string | null = null;
    // [why] Track the model name across iterations so we can sanitize
    // content parts (images → text) for text-only models.
    let modelRef: string | null = null;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      // Broadcast thinking phase
      if (boardId) {
        cardChatAssistDeps.broadcastCardChatProgress(boardId, {
          sessionId,
          cardId,
          phase: 'thinking',
        });
      }

      const completion = await cardChatAssistDeps.requestCardChatCompletion({
        messages: conversation,
        tools,
      });

      if (completion.status !== 200 || !completion.data) {
        // [why] Log the specific provider error so server logs show WHY the
        // AI request failed — not just the generic "assist-failed" code.
        console.error(
          `[card-chat/assist] Provider error: name=${completion.name ?? '(none)'}, status=${String(completion.status)}, message=${completion.message ?? '(none)'}`
        );
        // Broadcast done on error
        if (boardId) {
          cardChatAssistDeps.broadcastCardChatProgress(boardId, {
            sessionId,
            cardId,
            phase: 'done',
          });
        }
        return Response.json(
          { error: { code: 'assist-failed', message: 'AI assist request failed' } },
          { status: 502 }
        );
      }

      const data = completion.data;
      // [why] Capture the model name from the first completion so we can
      // sanitize content parts for text-only models.
      if (!modelRef) modelRef = data.model;
      const toolCalls: ToolCall[] | undefined = data.toolCalls as ToolCall[] | undefined;

      // No tool calls — AI is done, return the message
      if (!toolCalls || toolCalls.length === 0) {
        finalMessage = data.message ?? null;

        // Persist the assistant message
        if (finalMessage) {
          await cardChatAssistDeps.writeCardChatMessage({
            sessionId,
            cardId,
            authorId: userId,
            role: 'assistant',
            content: finalMessage,
          });
        }

        if (boardId) {
          cardChatAssistDeps.broadcastCardChatProgress(boardId, {
            sessionId,
            cardId,
            phase: 'done',
            actionCards: allActionCards,
          });
        }
        break;
      }

      const safeToolCalls: ToolCall[] = toolCalls;

      // Broadcast executing_tools phase
      const toolNames = safeToolCalls.map((tc) => tc.function.name);
      if (boardId) {
        cardChatAssistDeps.broadcastCardChatProgress(boardId, {
          sessionId,
          cardId,
          phase: 'executing_tools',
          toolNames,
        });
      }

      // Add assistant message with tool calls to conversation
      conversation.push({
        role: 'assistant',
        content: data.message ?? '',
        toolCalls: safeToolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      });

      // Execute all tool calls
      const executedToolCalls = await Promise.all(
        safeToolCalls.map(async (tc) => ({
          tc,
          result: await executeToolCall(
            tc,
            cardId,
            workspaceId,
            sessionId,
            modelRef ?? data.model,
            data.usage
          ),
        }))
      );

      // Collect action cards and add tool results to conversation
      let firstSuggestionGenerated = false;
      for (const executed of executedToolCalls) {
        const { tc, result } = executed;

        if (result.actionCard && allActionCards.length === 0) {
          allActionCards.push(result.actionCard);
          firstSuggestionGenerated = true;
        }

        conversation.push({
          role: 'tool',
          content: result.message ?? 'Tool executed successfully',
          toolCallId: tc.id,
        });
      }

      // [why] Inject multimodal content parts (images, text files from card
      // attachments) as a follow-up user message. Tool result messages only
      // accept string content — vision models expect images in user messages.
      // This lets Ollama and OpenAI-compatible vision models "see" attachments.
      // [why] Sanitize content parts for the active model — text-only models
      // like deepseek-r1 reject image_url parts with "invalid image input".
      const allContentParts: CardChatAssistContentPart[] = [];
      for (const executed of executedToolCalls) {
        if (executed.result.contentParts && executed.result.contentParts.length > 0) {
          allContentParts.push(...executed.result.contentParts);
        }
      }
      if (allContentParts.length > 0) {
        const safeParts = sanitizeContentPartsForModel(allContentParts, modelRef ?? data.model);
        conversation.push({
          role: 'user',
          content: safeParts,
        });
      }

      // Broadcast action cards as they arrive
      if (boardId && allActionCards.length > 0) {
        cardChatAssistDeps.broadcastCardChatProgress(boardId, {
          sessionId,
          cardId,
          phase: 'executing_tools',
          toolNames,
          actionCards: allActionCards,
        });
      }

      // [why] Card AI should present one suggestion at a time.
      // As soon as we produce the first description proposal, end this assist run.
      if (firstSuggestionGenerated) {
        if (boardId) {
          cardChatAssistDeps.broadcastCardChatProgress(boardId, {
            sessionId,
            cardId,
            phase: 'done',
            actionCards: allActionCards,
          });
        }
        break;
      }
    }

    // If loop exhausted without final message, use the last assistant content
    if (!finalMessage) {
      const lastAssistant = [...conversation].reverse().find((m) => m.role === 'assistant');
      // [why] content can be string | null | ContentPart[] — extract string.
      const rawContent = lastAssistant?.content;
      finalMessage =
        typeof rawContent === 'string' ? rawContent : 'I processed your request.';
    }

    return Response.json(
      {
        data: {
          userMessage: userMessage.data.message,
          message: finalMessage,
          actionCards: allActionCards,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    // [why] Catch thrown exceptions (e.g. DB failures, provider timeouts) so
    // the client always gets a structured error response instead of a silent hang.
    console.error(
      `[card-chat/assist] Unhandled exception: ${err instanceof Error ? err.message : String(err)}`
    );
    return Response.json(
      {
        error: {
          code: 'card-chat-assist-failed',
          message: 'Card chat assist request failed due to an internal error',
        },
      },
      { status: 500 }
    );
  }
}

// [why] Detect whether the active model supports vision (image_url content parts).
// Text-only models like deepseek-r1 reject multimodal messages with
// "invalid image input". Vision models accept base64 data URIs.
// Patterns cover common Ollama vision models and OpenAI vision-capable models.
// [why] Also check for vision-related keywords in the model name as a
// catch-all fallback — many new vision models may not match the explicit
// pattern list yet.
function isVisionModel(model: string): boolean {
  const visionPatterns = [
    /llava/i,
    /bakllava/i,
    /gemma.*3/i,
    /minicpm-v/i,
    /llama.*vision/i,
    /moondream/i,
    /gpt-4o/i,
    /gpt-4.*turbo/i,
    /gpt-4.*vision/i,
    /claude.*3/i,
    /claude.*3\.5/i,
    /pixtral/i,
    /phi.*vision/i,
    /qwen.*vl/i,
    /qwen2.*vl/i,
    /kimi/i,
    /granite.*vision/i,
    /cogvlm/i,
    /fuyu/i,
    /idefics/i,
    /paligemma/i,
    /internvl/i,
    /ovis/i,
  ];
  if (visionPatterns.some((p) => p.test(model))) return true;

  // [why] Keyword fallback — many vision models include these terms in their
  // name. This catches models not yet in the explicit pattern list above.
  const visionKeywords = /\b(vision|vl|multimodal|image|visual|ocr)\b/i;
  return visionKeywords.test(model);
}

// [why] Convert image_url content parts to text descriptions for text-only
// models. Preserves text parts unchanged. This prevents "invalid image input"
// errors from providers like deepseek-r1 that don't support vision.
function sanitizeContentPartsForModel(
  parts: CardChatAssistContentPart[],
  model: string
): CardChatAssistContentPart[] {
  if (isVisionModel(model)) return parts;

  // [why] Log when images are being stripped so operators can see that their
  // model isn't being detected as vision-capable.
  const imageCount = parts.filter((p) => p.type === 'image_url').length;
  if (imageCount > 0) {
    console.warn(
      `[card-chat/assist] Stripping ${String(imageCount)} image attachment(s) — ` +
        `model "${model}" was not detected as vision-capable. ` +
        `If this model supports vision, add it to the isVisionModel pattern list ` +
        `or ensure the model name includes a vision keyword (vision, vl, multimodal, image, visual, ocr).`
    );
  }

  const sanitized: CardChatAssistContentPart[] = [];
  const mimeRe = /^data:(image\/\w+);/;
  for (const part of parts) {
    if (part.type === 'image_url') {
      // [why] Extract MIME type from the data URI for a descriptive label.
      // The AI can still reason about the attachment's existence even if it
      // can't "see" the image.
      const url = part.image_url.url;
      let label = 'image';
      const mimeMatch = mimeRe.exec(url);
      if (mimeMatch?.[1]) {
        label = `${mimeMatch[1]} file`;
      }
      sanitized.push({
        type: 'text',
        text: `[Attachment: ${label}]`,
      });
    } else {
      sanitized.push(part);
    }
  }
  return sanitized;
}
