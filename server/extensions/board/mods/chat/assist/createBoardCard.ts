import { createHash } from 'node:crypto';
import { db } from '../../../../../common/db';
import { dispatchEvent } from '../../../../../mods/events/dispatch';
import { emitCardCreated } from '../../../../activity/mods/createActivityEvent';
import { createCard } from '../../../../card/mods/create';
import {
  requireWorkspaceMembership,
  requireMemberOrBoardGuestMember,
  type WorkspaceScopedRequest,
} from '../../../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../../../../board/middlewares/requireBoardWritable';
import type {
  BoardChatAssistActionCard,
  BoardChatAssistOutput,
  BoardChatAssistToolCall,
  BoardChatAssistToolDefinition,
} from '../../../types';

export const CREATE_BOARD_CARD_TOOL: BoardChatAssistToolDefinition = {
  type: 'function',
  function: {
    name: 'create_board_card',
    description: 'Create a new card on the current board. If listId is omitted, the card is created in the Backlog list (first list whose name contains "backlog", case-insensitive).',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Card title',
        },
        listId: {
          type: 'string',
          description: 'Target list ID. Omit to default to the Backlog list.',
        },
        description: {
          type: 'string',
          description: 'Optional card description',
        },
        startDate: {
          type: 'string',
          description: 'Optional start date in ISO 8601 format',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
};

interface CreateBoardCardArguments {
  title: string;
  listId?: string | null;
  description?: string | null;
  startDate?: string | null;
}

interface BoardContext {
  id: string;
  workspace_id: string;
  title: string;
  state: string;
}

interface CreateBoardCardInput {
  request: Request;
  board: BoardContext;
  actorId: string;
  toolCall: BoardChatAssistToolCall;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

const idempotencyCache = new Map<string, Promise<BoardChatAssistOutput>>();

function normalizeToolArguments(rawArguments: string): CreateBoardCardArguments | BoardChatAssistOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'create_board_card arguments must be valid JSON',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'create_board_card arguments must be an object',
    };
  }

  const candidate = parsed as Record<string, unknown>;
  const allowedKeys = new Set(['title', 'listId', 'description', 'startDate']);
  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) {
      return {
        status: 422,
        name: 'invalid-tool-payload',
        message: `create_board_card arguments contain unsupported field "${key}"`,
      };
    }
  }

  if (typeof candidate.title !== 'string' || candidate.title.trim() === '') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'create_board_card.title must be a non-empty string',
    };
  }

  if (candidate.title.trim().length > 512) {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'create_board_card.title must be 512 characters or fewer',
    };
  }

  if (typeof candidate.listId !== 'undefined' && candidate.listId !== null) {
    if (typeof candidate.listId !== 'string' || candidate.listId.trim() === '') {
      return {
        status: 422,
        name: 'invalid-tool-payload',
        message: 'create_board_card.listId must be a non-empty string when provided',
      };
    }
  }

  if (typeof candidate.description !== 'undefined' && candidate.description !== null && typeof candidate.description !== 'string') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'create_board_card.description must be a string or null',
    };
  }

  if (typeof candidate.startDate !== 'undefined' && candidate.startDate !== null && typeof candidate.startDate !== 'string') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'create_board_card.startDate must be a string or null',
    };
  }

  if (typeof candidate.startDate === 'string') {
    const parsedDate = new Date(candidate.startDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return {
        status: 422,
        name: 'invalid-tool-payload',
        message: 'create_board_card.startDate must be a valid ISO 8601 date string',
      };
    }
  }

  return {
    title: candidate.title.trim(),
    listId: typeof candidate.listId === 'string' ? candidate.listId.trim() : null,
    description: typeof candidate.description === 'string' ? candidate.description.trim() : null,
    startDate: typeof candidate.startDate === 'string' ? candidate.startDate : null,
  };
}

function buildIdempotencyKey({
  boardId,
  actorId,
  toolCallId,
  input,
}: {
  boardId: string;
  actorId: string;
  toolCallId: string;
  input: CreateBoardCardArguments;
}): string {
  return createHash('sha256')
    .update(JSON.stringify({
      boardId,
      actorId,
      toolCallId,
      title: input.title,
      listId: input.listId,
      description: input.description ?? null,
      startDate: input.startDate ?? null,
    }))
    .digest('hex');
}

async function runCreateBoardCard({
  request,
  board,
  actorId,
  toolCall,
  model,
  usage,
}: CreateBoardCardInput): Promise<BoardChatAssistOutput> {
  const normalized = normalizeToolArguments(toolCall.function.arguments);
  if ('status' in normalized) return normalized;

  const boardReq = request as BoardScopedRequest;
  const writableError = await requireBoardWritable(boardReq, board.id);
  if (writableError) {
    return {
      status: writableError.status,
      name: 'board-writable-check-failed',
      message: 'Board is not writable',
    };
  }

  const scopedReq = request as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) {
    return {
      status: membershipError.status,
      name: 'workspace-membership-required',
      message: 'Workspace membership is required',
    };
  }

  const roleError = await requireMemberOrBoardGuestMember(scopedReq, board.id);
  if (roleError) {
    return {
      status: roleError.status,
      name: 'board-card-create-forbidden',
      message: 'You do not have permission to create cards on this board',
    };
  }

  const idempotencyKey = buildIdempotencyKey({
    boardId: board.id,
    actorId,
    toolCallId: toolCall.id,
    input: normalized,
  });

  const cached = idempotencyCache.get(idempotencyKey);
  if (cached) return cached;

  const execution = (async (): Promise<BoardChatAssistOutput> => {
    let listId = normalized.listId;

    // [why] Default to Backlog when no listId is provided — resolves the
    // first list whose title contains "backlog" (case-insensitive).
    if (!listId) {
      const backlogList = await db('lists')
        .where({ board_id: board.id })
        .whereRaw('LOWER(title) LIKE ?', ['%backlog%'])
        .orderBy('position', 'asc')
        .first();

      if (!backlogList) {
        return {
          status: 404,
          name: 'backlog-list-not-found',
          message: 'No Backlog list found on this board. Please specify a listId.',
        };
      }

      listId = backlogList.id;
    }

    const list = await db('lists').where({ id: listId }).first();
    if (!list || list.board_id !== board.id) {
      return {
        status: 404,
        name: 'list-not-found',
        message: 'Target list not found',
      };
    }

    const createCardInput = {
      listId: list.id,
      title: normalized.title,
    } as Parameters<typeof createCard>[0];
    if (normalized.description !== null) {
      createCardInput.description = normalized.description;
    }
    if (normalized.startDate !== null) {
      createCardInput.startDate = normalized.startDate;
    }

    const card = await createCard(createCardInput);

    await Promise.all([
      dispatchEvent({
        type: 'card.created',
        boardId: board.id,
        entityId: card.id,
        actorId,
        payload: { card, listId: list.id },
      }),
      emitCardCreated({
        actorId,
        cardId: card.id,
        cardTitle: card.title,
        listId: list.id,
        listName: (list.title as string | null | undefined) ?? null,
        boardId: board.id,
        workspaceId: board.workspace_id,
        source: {
          type: 'board-chat-assist',
          tool: 'create_board_card',
          toolCallId: toolCall.id,
          idempotencyKey,
        },
        ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('cf-connecting-ip') ?? null,
        userAgent: request.headers.get('user-agent') ?? null,
      }),
    ]);

    const actionCard: BoardChatAssistActionCard = {
      state: 'confirmed',
      toolName: 'create_board_card',
      toolCallId: toolCall.id,
      idempotencyKey,
      source: 'board-chat-assist',
      boardId: board.id,
      workspaceId: board.workspace_id,
      cardId: card.id,
      cardTitle: card.title,
      listId: list.id,
      listName: (list.title as string | null | undefined) ?? null,
    };

    return {
      status: 200,
      data: {
        model,
        message: `Created card "${card.title}" in ${list.title ?? 'the target list'}.`,
        ...(usage ? { usage } : {}),
        toolCalls: [toolCall],
        actionCard,
      },
    };
  })();

  idempotencyCache.set(idempotencyKey, execution);
  try {
    return await execution;
  } finally {
    idempotencyCache.delete(idempotencyKey);
  }
}

export async function createBoardCard(input: CreateBoardCardInput): Promise<BoardChatAssistOutput> {
  return runCreateBoardCard(input);
}
