// deleteSpecsFile — tool definition and handler for deleting a specs markdown file
// from the board's linked GitHub repository. Executes immediately (not a proposal).
import { deleteSpecsFile } from '../../specs/delete';
import { downloadRepositoryFromProjectUrl } from '../../githubRepository/downloadRepositoryFromProjectUrl';
import type {
  BoardChatAssistToolDefinition,
  BoardChatAssistToolCall,
  BoardChatAssistOutput,
} from '../../../types';

export const DELETE_SPECS_FILE_TOOL: BoardChatAssistToolDefinition = {
  type: 'function',
  function: {
    name: 'delete_specs_file',
    description:
      'Delete a markdown documentation file from the board\'s linked GitHub repository. Use this to remove obsolete or incorrect specs. The file must be under specs/ and end with .md. This executes immediately — the file is deleted right away.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to the repository root, must start with "specs/" and end with ".md". Example: "specs/architecture/old-design.md".',
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
};

interface DeleteSpecsFileArguments {
  path: string;
}

export interface DeleteSpecsFileInput {
  board: {
    id: string;
    workspace_id: string;
    title: string;
    state: string;
    github_project_url?: string | null;
  };
  toolCall: BoardChatAssistToolCall;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export const deleteSpecsFileDeps = {
  downloadRepositoryFromProjectUrl,
  deleteSpecsFile,
};

function normalizeDeleteArguments(rawArguments: string): DeleteSpecsFileArguments | BoardChatAssistOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'delete_specs_file arguments must be valid JSON',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'delete_specs_file arguments must be an object',
    };
  }

  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.path !== 'string' || candidate.path.trim() === '') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'delete_specs_file.path must be a non-empty string',
    };
  }

  return { path: candidate.path.trim() };
}

export async function deleteSpecsFileTool({
  board,
  toolCall,
  model: _model,
  usage: _usage,
}: DeleteSpecsFileInput): Promise<BoardChatAssistOutput> {
  const normalized = normalizeDeleteArguments(toolCall.function.arguments);
  if ('status' in normalized) return normalized;

  if (!board.github_project_url) {
    return {
      status: 400,
      name: 'no-github-project-url',
      message: 'This board does not have a linked GitHub repository.',
    };
  }

  const normalizedPath = normalized.path.replace(/^\/+/, '');
  if (!normalizedPath.startsWith('specs/') || !normalizedPath.endsWith('.md')) {
    return {
      status: 422,
      name: 'invalid-specs-path',
      message: 'Path must start with "specs/" and end with ".md"',
    };
  }

  let repoPath: string;
  try {
    const repo = await deleteSpecsFileDeps.downloadRepositoryFromProjectUrl({
      projectUrl: board.github_project_url,
      boardId: board.id,
    });
    repoPath = repo.repoPath;
  } catch (err) {
    return {
      status: 502,
      name: 'repository-download-failed',
      message: err instanceof Error ? err.message : 'Failed to download repository',
    };
  }

  try {
    const result = await deleteSpecsFileDeps.deleteSpecsFile({ repoPath, filePath: normalizedPath });
    return {
      status: 200,
      data: {
        model: _model,
        message: result.deleted
          ? `Deleted \`${normalizedPath}\`.`
          : `File \`${normalizedPath}\` was already deleted or did not exist.`,
      },
    };
  } catch (err) {
    return {
      status: 500,
      name: 'specs-file-delete-failed',
      message: err instanceof Error ? err.message : 'Failed to delete specs file',
    };
  }
}
