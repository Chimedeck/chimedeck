import { createHash } from 'node:crypto';
import { dispatchEvent } from '../../../../../mods/events/dispatch';
import type {
  BoardChatAssistActionCard,
  BoardChatAssistOutput,
  BoardChatAssistToolCall,
  BoardChatAssistToolDefinition,
} from '../../../types';

// [why] A single-file proposal — the LLM can call this multiple times in one
// response to propose several documents. Nothing is written to disk yet;
// the client must call the commit endpoint to persist.
export const PROPOSE_GITHUB_DOCUMENT_TOOL: BoardChatAssistToolDefinition = {
  type: 'function',
  function: {
    name: 'propose_github_document',
    description:
      'Propose a markdown documentation file to write to the board\'s linked GitHub repository. The file will be shown to the user as a suggested change; it is only saved when the user confirms it. Use this to document decisions, architecture, requirements, or meeting notes. Call this tool once for each file you want to propose.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to the repository root, must start with "specs/" and end with ".md". Example: "specs/architecture/overview.md".',
        },
        content: {
          type: 'string',
          description: 'The full markdown content for the file.',
        },
        commitMessage: {
          type: 'string',
          description: 'Git commit message describing this change. Keep it concise.',
        },
      },
      required: ['path', 'content', 'commitMessage'],
      additionalProperties: false,
    },
  },
};

interface ProposeDocumentArguments {
  path: string;
  content: string;
  commitMessage: string;
}

interface ProposeGithubDocumentInput {
  boardId: string;
  board: {
    id: string;
    workspace_id: string;
    title: string;
    state: string;
    github_project_url?: string | null;
  };
  actorId: string;
  toolCall: BoardChatAssistToolCall;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function normalizeProposeArguments(rawArguments: string): ProposeDocumentArguments | BoardChatAssistOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'propose_github_document arguments must be valid JSON',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'propose_github_document arguments must be an object',
    };
  }

  const candidate = parsed as Record<string, unknown>;
  const allowedKeys = new Set(['path', 'content', 'commitMessage']);
  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) {
      return {
        status: 422,
        name: 'invalid-tool-payload',
        message: `propose_github_document arguments contain unsupported field "${key}"`,
      };
    }
  }

  if (typeof candidate.path !== 'string' || candidate.path.trim() === '') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'propose_github_document.path must be a non-empty string',
    };
  }

  if (typeof candidate.content !== 'string' || candidate.content.trim() === '') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'propose_github_document.content must be a non-empty string',
    };
  }

  if (typeof candidate.commitMessage !== 'string' || candidate.commitMessage.trim() === '') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'propose_github_document.commitMessage must be a non-empty string',
    };
  }

  return {
    path: candidate.path.trim(),
    content: candidate.content,
    commitMessage: candidate.commitMessage.trim(),
  };
}

function buildIdempotencyKey({
  boardId,
  actorId,
  toolCallId,
  path,
}: {
  boardId: string;
  actorId: string;
  toolCallId: string;
  path: string;
}): string {
  return createHash('sha256')
    .update(JSON.stringify({ boardId, actorId, toolCallId, path }))
    .digest('hex');
}

export const proposeGithubDocumentDeps = {
  dispatchEvent,
};

export function buildDocumentActionCard(input: {
  board: ProposeGithubDocumentInput['board'];
  actorId: string;
  toolCall: BoardChatAssistToolCall;
}): { actionCard: BoardChatAssistActionCard; output: BoardChatAssistOutput } {
  const normalized = normalizeProposeArguments(input.toolCall.function.arguments);
  if ('status' in normalized) {
    return { actionCard: null as unknown as BoardChatAssistActionCard, output: normalized };
  }

  if (!input.board.github_project_url) {
    return {
      actionCard: null as unknown as BoardChatAssistActionCard,
      output: {
        status: 400,
        name: 'no-github-project-url',
        message: 'This board does not have a linked GitHub repository.',
      },
    };
  }

  const normalizedPath = normalized.path.replace(/^\/+/, '');
  if (!normalizedPath.startsWith('specs/') || !normalizedPath.endsWith('.md')) {
    return {
      actionCard: null as unknown as BoardChatAssistActionCard,
      output: {
        status: 422,
        name: 'invalid-specs-path',
        message: 'Path must start with "specs/" and end with ".md"',
      },
    };
  }

  const idempotencyKey = buildIdempotencyKey({
    boardId: input.board.id,
    actorId: input.actorId,
    toolCallId: input.toolCall.id,
    path: normalizedPath,
  });

  const actionCard: BoardChatAssistActionCard = {
    state: 'suggested',
    toolName: 'propose_github_document',
    toolCallId: input.toolCall.id,
    idempotencyKey,
    source: 'board-chat-assist',
    boardId: input.board.id,
    workspaceId: input.board.workspace_id,
    documentPath: normalizedPath,
    documentContent: normalized.content,
    commitMessage: normalized.commitMessage,
  };

  return {
    actionCard,
    output: {
      status: 200,
      data: {
        model: '', // filled in by orchestrator
        message: `Proposed document: \`${normalizedPath}\``,
        toolCalls: [input.toolCall],
        actionCard,
      },
    },
  };
}

export async function proposeGithubDocument(input: ProposeGithubDocumentInput): Promise<BoardChatAssistOutput> {
  const { actionCard, output } = buildDocumentActionCard({
    board: input.board,
    actorId: input.actorId,
    toolCall: input.toolCall,
  });

  if ('status' in output && output.status !== 200) {
    return output;
  }

  // [why] Broadcast the proposal to all connected clients so they see
  // suggested documents in realtime without a page refresh.
  proposeGithubDocumentDeps.dispatchEvent({
    type: 'board_chat.document_proposed',
    boardId: input.boardId,
    entityId: actionCard.idempotencyKey,
    actorId: input.actorId,
    payload: {
      actionCard,
    },
  }).catch(() => {
    // [why] Fire-and-forget — a failed broadcast must not fail the proposal.
  });

  return {
    ...output,
    data: output.data ? {
      ...output.data,
      model: input.model,
      ...(input.usage ? { usage: input.usage } : {}),
    } : undefined,
  };
}
