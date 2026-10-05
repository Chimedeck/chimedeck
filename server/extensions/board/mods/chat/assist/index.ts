import { db } from '../../../../../common/db';
import { dispatchEvent } from '../../../../../mods/events/dispatch';
import { writeBoardChatMessage } from '../messages/write';
import { broadcast } from '../../../../realtime/mods/rooms/broadcast';
import type {
  BoardChatAssistInput,
  BoardChatAssistMessage,
  BoardChatAssistOutput,
  BoardChatAssistToolCall,
  BoardChatAssistActionCard,
  BoardChatAssistContentPart,
} from '../../../types';
import { CREATE_BOARD_CARD_TOOL, createBoardCard } from './createBoardCard';
import { SEARCH_CARDS_TOOL, searchCards } from './searchCards';
import { PROPOSE_GITHUB_DOCUMENT_TOOL, buildDocumentActionCard } from './proposeGithubDocument';
import { READ_SPECS_FILE_TOOL, readSpecsFileTool } from './readSpecsFile';
import { LIST_SPECS_FILES_TOOL, listSpecsFilesTool } from './listSpecsFiles';
import { DELETE_SPECS_FILE_TOOL, deleteSpecsFileTool } from './deleteSpecsFile';
import { requestBoardChatAssistCompletion } from './provider';
import { recordSessionInstance } from './multiInstanceSessionTracker';
import { env } from '../../../../../config/env';
import { READ_ATTACHMENTS_TOOL, readAttachments } from './readAttachments';

const DEFAULT_CONTEXT_LIMIT = 12;
const MAX_CONTEXT_LIMIT = 50;

interface ContextMessageRow {
  content: string;
  author_name: string | null;
  is_assistant: boolean;
}

// [why] All tools the assistant can invoke, registered in one place so the
// prompt builder and the tool dispatcher stay in sync.
const ALL_TOOLS = [
  CREATE_BOARD_CARD_TOOL,
  SEARCH_CARDS_TOOL,
  READ_ATTACHMENTS_TOOL,
  READ_SPECS_FILE_TOOL,
  LIST_SPECS_FILES_TOOL,
  DELETE_SPECS_FILE_TOOL,
  PROPOSE_GITHUB_DOCUMENT_TOOL,
] as const;

interface ToolContext {
  boardId: string;
  board: {
    id: string;
    workspace_id: string;
    title: string;
    state: string;
    github_project_url?: string | null;
  };
  actorId: string;
  request: Request;
}

function normalizeContextLimit(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_CONTEXT_LIMIT;
  return Math.min(Math.max(Math.floor(value), 1), MAX_CONTEXT_LIMIT);
}

function buildAssistMessages({
  prompt,
  contextRows,
}: {
  prompt: string;
  contextRows: ContextMessageRow[];
}): BoardChatAssistMessage[] {
  const messages: BoardChatAssistMessage[] = [
    {
      role: 'system',
      content:
        'You are an assistant for board collaboration chat (ChimeDeck). Be concise, actionable, and grounded in the provided board chat context.',
    },
    {
      role: 'system',
      content: [
        'You have access to the following tools:',
        '- search_cards: search for existing cards on this board by keyword. Use this FIRST when the user asks about existing work, card status, or "what do we have" questions to avoid creating duplicates. Use the retrieved data to explain the card\'s purpose, status, and business value to the user.',
        '- read_attachments: read specific file attachments from a card. Use this when the user asks to read particular files from a card that has attachments. Provide the card_id and optionally a list of file_names. If file_names is omitted, all readable files are fetched. When a card has more than 3 attachments, search_cards only processes 3 — use read_attachments to fetch the remaining files the user wants.',
        '- create_board_card: create a new card on the board. Use this when the user explicitly wants to track a task, idea, or action item.',
        "- read_specs_file: read the contents of a markdown documentation file from the board's GitHub repository. Use this to inspect existing specs before proposing edits. The file must be under specs/ and end with .md.",
        "- list_specs_files: list all markdown documentation files under specs/ in the board's GitHub repository. Use this to discover what documentation already exists before proposing changes.",
        "- delete_specs_file: delete a markdown documentation file from the board's GitHub repository. Use this to remove obsolete or incorrect specs. This executes immediately.",
        "- propose_github_document: propose a markdown document to add to the board's GitHub repository. The document will be shown on-screen for review before being saved — nothing is committed until the user confirms. Call this once per file you want to propose.",
        '',
        'Guidelines:',
        '- Always search before creating — if the user asks about something that might already exist, call search_cards first.',
        '- Explaining Cards: When summarizing or explaining cards retrieved via search_cards, do not just dump raw data. Synthesize the information. Explain what the card *means* in the context of the project—highlighting its primary objective, current status, business value, and any obvious blockers or next steps.',
        '- For documentation requests: call list_specs_files ONCE to discover what exists, then call search_cards ONCE for relevant cards. After ONE round of discovery tools, proceed directly to propose_github_document. Do NOT repeat list_specs_files or search_cards — one call each is sufficient.',
        '- When asked to create NEW documentation (not editing existing files), skip read_specs_file and go straight to propose_github_document after listing files.',
        '- When asked to UPDATE existing documentation, follow the reason-act loop: list → read → propose edits. Never propose changes without reading the current content first.',
        '- For documentation requests, propose one file at a time. If the user asks for multiple documents or a full docs structure, call propose_github_document multiple times in one response — the system collects all proposals and shows them together.',
        '- Each proposed document must have its own path under specs/ (e.g. specs/architecture/auth.md, specs/api/endpoints.md).',
        '- When creating cards, default to the Backlog list. Search for a list containing "backlog" (case-insensitive) and use the first result. If no Backlog list exists, ask the user which list to use.',
        '- Never reply with a manual checklist when a tool can do the work — call the tool instead.',
      ].join('\n'),
    },
  ];

  if (contextRows.length > 0) {
    // [why] Inject previous messages with their proper roles (user/assistant)
    // so the AI sees them as actual conversation history, not just background
    // context. This enables the AI to resolve anaphoric references like
    // "in there" → "the card we were discussing" across turns.
    for (const row of contextRows) {
      messages.push({
        role: row.is_assistant ? 'assistant' : 'user',
        content: row.content,
      });
    }
  }

  messages.push({
    role: 'user',
    content: prompt,
  });
  return messages;
}

export const boardChatAssistDeps = {
  fetchRecentBoardMessages: async ({
    boardId,
    limit,
    threadId,
  }: {
    boardId: string;
    limit: number;
    threadId?: string;
  }): Promise<ContextMessageRow[]> => {
    let query = db('board_chat_messages as m')
      .leftJoin('users as u', 'm.author_id', 'u.id')
      .where('m.board_id', boardId)
      .orderBy('m.created_at', 'desc')
      .limit(limit)
      .select('m.content', 'm.is_assistant', db.raw('COALESCE(u.name, u.email) as author_name'));
    // [why] Scope to the active session so context doesn't bleed across sessions.
    if (threadId) {
      query = query.where('m.thread_id', threadId);
    }
    const rows = (await query) as ContextMessageRow[];
    return rows.reverse();
  },
  requestBoardChatAssistCompletion,
  createBoardCard,
  searchCards,
  readAttachments,
  readSpecsFileTool,
  listSpecsFilesTool,
  deleteSpecsFileTool,
  dispatchEvent,
  writeBoardChatMessage,
};

function hasToolCalls(data: BoardChatAssistOutput['data']): data is NonNullable<
  BoardChatAssistOutput['data']
> & {
  toolCalls: BoardChatAssistToolCall[];
} {
  return Array.isArray(data?.toolCalls) && data.toolCalls.length > 0;
}

// [why] Usage object may be undefined — exactOptionalPropertyTypes requires
// explicit conditional spread to avoid passing `undefined` to tool inputs.
function maybeUsage(usage?: {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}) {
  return usage ?? {};
}

interface ToolCallResult {
  message?: string;
  actionCard?: BoardChatAssistActionCard;
  error?: BoardChatAssistOutput;
  // [why] Multimodal content parts (images, text files) from card attachments.
  // Carried alongside the message so the tool loop can inject them as a
  // follow-up user message for vision-capable providers.
  contentParts?: BoardChatAssistContentPart[];
}

// [why] Handle a single tool call. Search, create_board_card, read/list/delete
// specs execute immediately; propose_github_document builds a suggested action
// card without touching disk.
async function executeOneToolCall(
  toolCall: BoardChatAssistToolCall,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
  ctx: ToolContext,
  deps: {
    createBoardCard: typeof createBoardCard;
    searchCards: typeof searchCards;
    readAttachments: typeof readAttachments;
    readSpecsFileTool: typeof readSpecsFileTool;
    listSpecsFilesTool: typeof listSpecsFilesTool;
    deleteSpecsFileTool: typeof deleteSpecsFileTool;
    dispatchEvent: typeof dispatchEvent;
  }
): Promise<ToolCallResult> {
  const toolName = toolCall.function.name;
  const output: ToolCallResult = {};

  if (toolName === 'search_cards') {
    const result = await deps.searchCards({
      boardId: ctx.boardId,
      toolCall,
      model,
      ...maybeUsage(usage),
    });
    if (result.status !== 200) {
      output.error = result;
      return output;
    }
    if (result.data?.message) output.message = result.data.message;
    if (result.data?.contentParts) output.contentParts = result.data.contentParts;
    return output;
  }

  if (toolName === 'read_attachments') {
    const result = await deps.readAttachments({
      boardId: ctx.boardId,
      toolCall,
      model,
      ...maybeUsage(usage),
    });
    if (result.status !== 200) {
      output.error = result;
      return output;
    }
    if (result.data?.message) output.message = result.data.message;
    if (result.data?.contentParts) output.contentParts = result.data.contentParts;
    return output;
  }

  if (toolName === 'create_board_card') {
    const input: Parameters<typeof deps.createBoardCard>[0] = {
      request: ctx.request,
      board: ctx.board,
      actorId: ctx.actorId,
      toolCall,
      model,
      usage,
    };
    const result = await deps.createBoardCard(input);
    if (result.status !== 200) {
      output.error = result;
      return output;
    }
    if (result.data?.message) output.message = result.data.message;
    if (result.data?.actionCard) output.actionCard = result.data.actionCard;
    return output;
  }

  if (toolName === 'propose_github_document') {
    const { actionCard, output: proposeOutput } = buildDocumentActionCard({
      board: ctx.board,
      actorId: ctx.actorId,
      toolCall,
    });
    if (proposeOutput.status !== 200 || 'name' in proposeOutput) {
      const err = proposeOutput as { status?: number; name?: string; message?: string };
      output.error = {
        status: err.status ?? 422,
        name: err.name ?? 'invalid-tool-payload',
        message: err.message ?? 'propose_github_document failed',
      };
      return output;
    }
    output.message = `Proposed document: \`${actionCard.documentPath ?? 'unknown'}\``;
    output.actionCard = actionCard;
    return output;
  }

  if (toolName === 'read_specs_file') {
    const result = await deps.readSpecsFileTool({
      board: ctx.board,
      toolCall,
      model,
      ...maybeUsage(usage),
    });
    if (result.status !== 200) {
      output.error = result;
      return output;
    }
    if (result.data?.message) output.message = result.data.message;
    return output;
  }

  if (toolName === 'list_specs_files') {
    const result = await deps.listSpecsFilesTool({
      board: ctx.board,
      toolCall,
      model,
      ...maybeUsage(usage),
    });
    if (result.status !== 200) {
      output.error = result;
      return output;
    }
    if (result.data?.message) output.message = result.data.message;
    return output;
  }

  if (toolName === 'delete_specs_file') {
    const result = await deps.deleteSpecsFileTool({
      board: ctx.board,
      toolCall,
      model,
      ...maybeUsage(usage),
    });
    if (result.status !== 200) {
      output.error = result;
      return output;
    }
    if (result.data?.message) output.message = result.data.message;
    return output;
  }

  output.error = {
    status: 422,
    name: 'unsupported-tool',
    message: `Assistant requested unsupported tool "${toolName}"`,
  };
  return output;
}

// [why] Prevent runaway tool loops — if the LLM keeps calling tools without
// reaching a conclusion, we stop after this many rounds and return whatever
// we have so far rather than consuming resources indefinitely.
const MAX_TOOL_ITERATIONS = 8;

// [why] Broadcast per-iteration progress to all connected clients so the
// chat drawer can show real-time streaming updates instead of a static
// typing indicator for the entire multi-minute tool-use loop.
function broadcastProgress(
  boardId: string,
  sessionId: string,
  progress: {
    iteration: number;
    maxIterations: number;
    phase: 'thinking' | 'calling_tools' | 'executing_tools' | 'done';
    toolNames?: string[];
    message?: string;
    actionCards?: BoardChatAssistActionCard[];
    // [why] Stream document paths from propose_github_document tool calls so
    // the client can show "Creating specs/pricing.md…" instead of just
    // "Running: propose_github_document" with bouncing dots.
    documentPaths?: string[];
  }
) {
  const payload = JSON.stringify({
    type: 'board_chat.assist_progress',
    board_id: boardId,
    payload: { sessionId, ...progress },
    emittedAt: Date.now(),
  });
  broadcast({ boardId, message: payload });
}

// [why] Broadcast proposed documents to all connected clients so they
// appear in realtime without a page refresh.
function broadcastProposals(
  actionCards: BoardChatAssistActionCard[],
  boardId: string,
  actorId: string
) {
  for (const card of actionCards) {
    if (card.toolName === 'propose_github_document' && card.state === 'suggested') {
      boardChatAssistDeps
        .dispatchEvent({
          type: 'board_chat.document_proposed',
          boardId,
          entityId: card.idempotencyKey,
          actorId,
          payload: { actionCard: card },
        })
        .catch(() => {});
    }
  }
}

// [why] Run one iteration of the tool-use loop: call LLM, collect assistant
// response, execute tool calls, return accumulated results. Broadcasts
// progress events via WebSocket so the client can show real-time streaming
// updates instead of a static typing indicator.
interface RunIterationOptions {
  sessionId: string;
  iteration: number;
}

async function runToolUseIteration(
  conversation: BoardChatAssistMessage[],
  allActionCards: BoardChatAssistActionCard[],
  allMessages: string[],
  totalUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
  modelRef: { value: string },
  ctx: ToolContext,
  opts: RunIterationOptions
): Promise<{ shouldStop: boolean; error?: BoardChatAssistOutput }> {
  const { sessionId, iteration } = opts;
  // [why] Tell the client the AI is thinking — this replaces the generic
  // typing indicator with a specific phase label.
  broadcastProgress(ctx.boardId, sessionId, {
    iteration,
    maxIterations: MAX_TOOL_ITERATIONS,
    phase: 'thinking',
  });

  const completion = await boardChatAssistDeps.requestBoardChatAssistCompletion({
    messages: conversation,
    tools: [...ALL_TOOLS],
  });

  if (completion.status !== 200 || !completion.data) {
    broadcastProgress(ctx.boardId, sessionId, {
      iteration,
      maxIterations: MAX_TOOL_ITERATIONS,
      phase: 'done',
      message: 'AI request failed',
    });
    return { shouldStop: true, error: completion };
  }

  const { data } = completion;
  modelRef.value = data.model;
  if (data.usage) {
    totalUsage.prompt_tokens += data.usage.prompt_tokens ?? 0;
    totalUsage.completion_tokens += data.usage.completion_tokens ?? 0;
    totalUsage.total_tokens += data.usage.total_tokens ?? 0;
  }

  // [why] Append assistant response to conversation. content may be null
  // when the response contains only tool calls (some providers do this).
  // Ollama rejects null content — use empty string as fallback.
  conversation.push({
    role: 'assistant',
    content: data.message ?? '',
    ...(data.toolCalls ? { toolCalls: data.toolCalls } : {}),
  });

  if (data.message) {
    allMessages.push(data.message);
  }

  // Plain text with no tool calls → done
  if (!hasToolCalls(data)) {
    broadcastProgress(ctx.boardId, sessionId, {
      iteration,
      maxIterations: MAX_TOOL_ITERATIONS,
      phase: 'done',
      ...(data.message ? { message: data.message } : {}),
    });
    return { shouldStop: true };
  }

  // [why] Tell the client which tools are being called so the user
  // understands what the AI is doing (e.g. "searching cards", "listing docs").
  const toolNames = data.toolCalls.map((tc) => tc.function.name);

  // [why] Extract document paths from propose_github_document tool calls so
  // the client can show "Creating specs/pricing.md…" instead of just
  // "Running: propose_github_document" with bouncing dots.
  const documentPaths: string[] = [];
  for (const tc of data.toolCalls) {
    if (tc.function.name === 'propose_github_document') {
      try {
        const args = JSON.parse(tc.function.arguments) as { path?: string };
        if (args.path) documentPaths.push(args.path);
      } catch {
        /* ignore malformed JSON — the tool executor will catch it */
      }
    }
  }

  broadcastProgress(ctx.boardId, sessionId, {
    iteration,
    maxIterations: MAX_TOOL_ITERATIONS,
    phase: 'executing_tools',
    toolNames,
    ...(documentPaths.length > 0 ? { documentPaths } : {}),
  });

  // Execute all tool calls
  const results = await Promise.all(
    data.toolCalls.map((tc) =>
      executeOneToolCall(tc, modelRef.value, data.usage ?? {}, ctx, boardChatAssistDeps)
    )
  );

  for (const result of results) {
    if (result.actionCard) {
      allActionCards.push(result.actionCard);
    }
  }

  // [why] Broadcast newly created action cards immediately so the client
  // can show document proposals or card creations as they happen.
  const newActionCards: BoardChatAssistActionCard[] = [];
  for (const result of results) {
    if (result.actionCard) {
      newActionCards.push(result.actionCard);
    }
  }
  if (newActionCards.length > 0) {
    broadcastProgress(ctx.boardId, sessionId, {
      iteration,
      maxIterations: MAX_TOOL_ITERATIONS,
      phase: 'executing_tools',
      toolNames,
      actionCards: newActionCards,
    });
  }

  // Feed tool results back into conversation for the next iteration
  conversation.push(...buildToolResultMessages(results, data.toolCalls));

  // [why] Inject multimodal content parts (images, text files from card
  // attachments) as a follow-up user message. Tool result messages only
  // accept string content — vision models expect images in user messages.
  // This lets Ollama and OpenAI-compatible vision models "see" attachments.
  // [why] Sanitize content parts for the active model — text-only models
  // like deepseek-r1 reject image_url parts with "invalid image input".
  const allContentParts: BoardChatAssistContentPart[] = [];
  for (const result of results) {
    if (result.contentParts && result.contentParts.length > 0) {
      allContentParts.push(...result.contentParts);
    }
  }
  if (allContentParts.length > 0) {
    const safeParts = sanitizeContentPartsForModel(allContentParts, modelRef.value);
    conversation.push({
      role: 'user',
      content: safeParts,
    });
  }

  const allErrors = results.filter((r) => r.error);
  const error = allErrors.length === results.length ? allErrors[0]?.error : undefined;
  return error ? { shouldStop: true, error } : { shouldStop: false };
}

// [why] Feed tool results back to the LLM as tool messages so it can
// clarify, ask follow-ups, or proceed to the next step. The conversation
// history grows across iterations until the LLM stops calling tools or
// we hit MAX_TOOL_ITERATIONS.
function buildToolResultMessages(
  results: ToolCallResult[],
  toolCalls: BoardChatAssistToolCall[]
): BoardChatAssistMessage[] {
  const messages: BoardChatAssistMessage[] = [];
  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    if (!tc) continue;
    const result = results[i];
    const content = result?.message ?? result?.error?.message ?? '';
    messages.push({
      role: 'tool',
      toolCallId: tc.id,
      content,
    });
  }
  return messages;
}

// [why] Detect whether the active model supports vision (image_url content parts).
// Text-only models like deepseek-r1 reject multimodal messages with
// "invalid image input". Vision models accept base64 data URIs.
// Patterns cover common Ollama vision models and OpenAI vision-capable models.
// [why] Also check for vision-related keywords in the model name as a
// catch-all fallback — many new vision models (e.g. kimi-k2.7-code:cloud,
// granite3.2-vision) may not match the explicit pattern list yet.
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
  parts: BoardChatAssistContentPart[],
  model: string
): BoardChatAssistContentPart[] {
  if (isVisionModel(model)) return parts;

  // [why] Log when images are being stripped so operators can see that their
  // model isn't being detected as vision-capable. This helps diagnose
  // "images not reaching the AI" issues.
  const imageCount = parts.filter((p) => p.type === 'image_url').length;
  if (imageCount > 0) {
    console.warn(
      `[chat/assist] Stripping ${String(imageCount)} image attachment(s) — ` +
        `model "${model}" was not detected as vision-capable. ` +
        `If this model supports vision, add it to the isVisionModel pattern list ` +
        `or ensure the model name includes a vision keyword (vision, vl, multimodal, image, visual, ocr).`
    );
  }

  const sanitized: BoardChatAssistContentPart[] = [];
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

export async function assistBoardChat({
  boardId,
  sessionId,
  prompt,
  contextLimit,
  request,
  actorId,
  board,
}: BoardChatAssistInput & {
  request: Request;
  actorId: string;
  board: {
    id: string;
    workspace_id: string;
    title: string;
    state: string;
    github_project_url?: string | null;
  };
}): Promise<BoardChatAssistOutput> {
  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt === '') {
    return { status: 400, name: 'missing-prompt', message: 'prompt is required' };
  }

  const recentMessages = await boardChatAssistDeps.fetchRecentBoardMessages({
    boardId,
    limit: normalizeContextLimit(contextLimit),
    // [why] Scope context to the active session only.
    threadId: sessionId,
  });

  // [why] Conversation history that grows across tool-use iterations. Starts
  // with system prompts + recent chat context + user prompt, then accumulates
  // assistant tool calls and tool results.
  const conversation: BoardChatAssistMessage[] = [
    ...buildAssistMessages({
      prompt: normalizedPrompt,
      contextRows: recentMessages,
    }),
  ];

  const allActionCards: BoardChatAssistActionCard[] = [];
  const allMessages: string[] = [];
  const totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const modelRef = { value: '' };
  const ctx: ToolContext = { boardId, board, actorId, request };

  // [why] Multi-turn tool-use loop — after executing tools, feed results
  // back to the LLM so it can clarify, ask questions, or proceed to the
  // next step. Stops when the LLM returns plain text (no tool calls) or
  // we exhaust MAX_TOOL_ITERATIONS.
  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const { shouldStop, error } = await runToolUseIteration(
      conversation,
      allActionCards,
      allMessages,
      totalUsage,
      modelRef,
      ctx,
      { sessionId, iteration }
    );
    if (shouldStop) {
      if (allActionCards.length === 0 && allMessages.length === 0) {
        return (
          error ?? {
            status: 200,
            data: { model: modelRef.value, message: 'No response generated.' },
          }
        );
      }
      break;
    }
  }

  // [why] Broadcast proposals after ALL iterations complete so clients
  // receive the full batch in one burst.
  broadcastProposals(allActionCards, boardId, actorId);

  // [why] In multi-instance deployments behind an ALB, record which instance
  // handled this session so the commit endpoint can verify the request lands
  // on the same instance that holds the locally-written proposal files.
  // Only record when there are actual document proposals (propose_github_document)
  // — card creation doesn't touch the local git clone, and users can resume
  // older chats that may have had card-only action cards.
  if (
    env.MULTI_INSTANCE_HANDLING_ENABLED &&
    allActionCards.some((c) => c.toolName === 'propose_github_document')
  ) {
    recordSessionInstance(sessionId, request);
  }

  // [why] Persist the AI response as a chat message so it survives page
  // reloads. Scoped to the active session.
  const aiText = allMessages.join('\n\n');
  if (aiText) {
    try {
      await boardChatAssistDeps.writeBoardChatMessage({
        boardId,
        sessionId,
        authorId: null,
        content: aiText,
        isAssistant: true,
      });
    } catch (err) {
      console.error(
        `[chat/assist] Failed to persist AI response: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return {
    status: 200,
    data: {
      model: modelRef.value,
      message: allMessages.join('\n\n'),
      ...(totalUsage.total_tokens > 0 ? { usage: totalUsage } : {}),
      ...(allActionCards.length === 1 ? { actionCard: allActionCards[0] } : {}),
      ...(allActionCards.length > 1 ? { actionCards: allActionCards } : {}),
    },
  };
}
