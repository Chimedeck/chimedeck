import { db } from '../../../../../common/db';
import { dispatchEvent } from '../../../../../mods/events/dispatch';
import type {
  BoardChatAssistInput,
  BoardChatAssistMessage,
  BoardChatAssistOutput,
  BoardChatAssistToolCall,
  BoardChatAssistActionCard,
} from '../../../types';
import { CREATE_BOARD_CARD_TOOL, createBoardCard } from './createBoardCard';
import { SEARCH_CARDS_TOOL, searchCards } from './searchCards';
import { PROPOSE_GITHUB_DOCUMENT_TOOL, buildDocumentActionCard } from './proposeGithubDocument';
import { requestBoardChatAssistCompletion } from './provider';

const DEFAULT_CONTEXT_LIMIT = 12;
const MAX_CONTEXT_LIMIT = 50;

interface ContextMessageRow {
  content: string;
  author_name: string | null;
}

// [why] All tools the assistant can invoke, registered in one place so the
// prompt builder and the tool dispatcher stay in sync.
const ALL_TOOLS = [
  CREATE_BOARD_CARD_TOOL,
  SEARCH_CARDS_TOOL,
  PROPOSE_GITHUB_DOCUMENT_TOOL,
] as const;

interface ToolContext {
  boardId: string;
  board: { id: string; workspace_id: string; title: string; state: string; github_project_url?: string | null };
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
        '- search_cards: search for existing cards on this board by keyword. Use this FIRST when the user asks about existing work, card status, or "what do we have" questions — avoid creating duplicates.',
        '- create_board_card: create a new card on the board. Use this when the user explicitly wants to track a task, idea, or action item.',
        '- propose_github_document: propose a markdown document to add to the board\'s GitHub repository. The document will be shown on-screen for review before being saved — nothing is committed until the user confirms. Call this once per file you want to propose.',
        '',
        'Guidelines:',
        '- Always search before creating — if the user asks about something that might already exist, call search_cards first.',
        '- For documentation requests, propose one file at a time. If the user asks for multiple documents or a full docs structure, call propose_github_document multiple times in one response — the system collects all proposals and shows them together.',
        '- Each proposed document must have its own path under specs/ (e.g. specs/architecture/auth.md, specs/api/endpoints.md).',
        '- When creating cards, ask the user which list to use if you don\'t know it.',
        '- Never reply with a manual checklist when a tool can do the work — call the tool instead.',
      ].join('\n'),
    },
  ];

  if (contextRows.length > 0) {
    const contextLines = contextRows.map((row) => {
      const authorName = row.author_name?.trim() || 'Unknown user';
      return `- ${authorName}: ${row.content}`;
    });
    messages.push({
      role: 'system',
      content: `Recent board chat context:\n${contextLines.join('\n')}`,
    });
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
  }: {
    boardId: string;
    limit: number;
  }): Promise<ContextMessageRow[]> => {
    const rows = await db('board_chat_messages as m')
      .leftJoin('users as u', 'm.author_id', 'u.id')
      .where('m.board_id', boardId)
      .orderBy('m.created_at', 'desc')
      .limit(limit)
      .select(
        'm.content',
        db.raw('COALESCE(u.name, u.email) as author_name'),
      );
    return (rows as ContextMessageRow[]).reverse();
  },
  requestBoardChatAssistCompletion,
  createBoardCard,
  searchCards,
  dispatchEvent,
};

function hasToolCalls(data: BoardChatAssistOutput['data']): data is NonNullable<BoardChatAssistOutput['data']> & {
  toolCalls: BoardChatAssistToolCall[];
} {
  return Array.isArray(data?.toolCalls) && data.toolCalls.length > 0;
}

// [why] Usage object may be undefined — exactOptionalPropertyTypes requires
// explicit conditional spread to avoid passing `undefined` to tool inputs.
function maybeUsage(usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) {
  return usage ?? {};
}

interface ToolCallResult {
  message?: string;
  actionCard?: BoardChatAssistActionCard;
  error?: BoardChatAssistOutput;
}

// [why] Handle a single tool call. Search and create_board_card execute immediately;
// propose_github_document builds a suggested action card without touching disk.
async function executeOneToolCall(
  toolCall: BoardChatAssistToolCall,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
  ctx: ToolContext,
  deps: {
    createBoardCard: typeof createBoardCard;
    searchCards: typeof searchCards;
    dispatchEvent: typeof dispatchEvent;
  },
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
    if (result.status !== 200) { output.error = result; return output; }
    if (result.data?.message) output.message = result.data.message;
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
    if (result.status !== 200) { output.error = result; return output; }
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

// [why] Broadcast proposed documents to all connected clients so they
// appear in realtime without a page refresh.
function broadcastProposals(actionCards: BoardChatAssistActionCard[], boardId: string, actorId: string) {
  for (const card of actionCards) {
    if (card.toolName === 'propose_github_document' && card.state === 'suggested') {
      boardChatAssistDeps.dispatchEvent({
        type: 'board_chat.document_proposed',
        boardId,
        entityId: card.idempotencyKey,
        actorId,
        payload: { actionCard: card },
      }).catch(() => {});
    }
  }
}

// [why] Run one iteration of the tool-use loop: call LLM, collect assistant
// response, execute tool calls, return accumulated results.
async function runToolUseIteration(
  conversation: BoardChatAssistMessage[],
  allActionCards: BoardChatAssistActionCard[],
  allMessages: string[],
  totalUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
  modelRef: { value: string },
  ctx: ToolContext,
): Promise<{ shouldStop: boolean; error?: BoardChatAssistOutput }> {
  const completion = await boardChatAssistDeps.requestBoardChatAssistCompletion({
    messages: conversation,
    tools: [...ALL_TOOLS],
  });

  if (completion.status !== 200 || !completion.data) {
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
  conversation.push({
    role: 'assistant',
    content: data.message ?? null,
    ...(data.toolCalls ? { toolCalls: data.toolCalls } : {}),
  });

  if (data.message) {
    allMessages.push(data.message);
  }

  // Plain text with no tool calls → done
  if (!hasToolCalls(data)) {
    return { shouldStop: true };
  }

  // Execute all tool calls
  const results = await Promise.all(
    data.toolCalls.map((tc) =>
      executeOneToolCall(tc, modelRef.value, data.usage ?? {}, ctx, boardChatAssistDeps),
    ),
  );

  for (const result of results) {
    if (result.actionCard) {
      allActionCards.push(result.actionCard);
    }
  }

  // Feed tool results back into conversation for the next iteration
  conversation.push(...buildToolResultMessages(results, data.toolCalls));

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
  toolCalls: BoardChatAssistToolCall[],
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

export async function assistBoardChat({
  boardId,
  prompt,
  contextLimit,
  request,
  actorId,
  board,
}: BoardChatAssistInput & {
  request: Request;
  actorId: string;
  board: { id: string; workspace_id: string; title: string; state: string; github_project_url?: string | null };
}): Promise<BoardChatAssistOutput> {
  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt === '') {
    return { status: 400, name: 'missing-prompt', message: 'prompt is required' };
  }

  const recentMessages = await boardChatAssistDeps.fetchRecentBoardMessages({
    boardId,
    limit: normalizeContextLimit(contextLimit),
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
    );
    if (shouldStop) {
      if (allActionCards.length === 0 && allMessages.length === 0) {
        return error ?? { status: 200, data: { model: modelRef.value, message: 'No response generated.' } };
      }
      break;
    }
  }

  // [why] Broadcast proposals after ALL iterations complete so clients
  // receive the full batch in one burst.
  broadcastProposals(allActionCards, boardId, actorId);

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
