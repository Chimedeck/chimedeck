// readSpecsFile — tool definition and handler for reading a specs markdown file
// from the board's linked GitHub repository. Executes immediately (not a proposal).
import { readSpecsFile } from '../../specs/read';
import { resolveSpecsFilePath } from '../../specs/resolvePath';
import { downloadRepositoryFromProjectUrl } from '../../githubRepository/downloadRepositoryFromProjectUrl';
import type {
  BoardChatAssistToolDefinition,
  BoardChatAssistToolCall,
  BoardChatAssistOutput,
} from '../../../types';

export const READ_SPECS_FILE_TOOL: BoardChatAssistToolDefinition = {
  type: 'function',
  function: {
    name: 'read_specs_file',
    description:
      'Read the contents of a markdown documentation file from the board\'s linked GitHub repository. Use this to inspect existing specs before proposing edits. The file must be under specs/ and end with .md.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to the repository root, must start with "specs/" and end with ".md". Example: "specs/architecture/overview.md".',
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
};

interface ReadSpecsFileArguments {
  path: string;
}

export interface ReadSpecsFileInput {
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

export const readSpecsFileDeps = {
  downloadRepositoryFromProjectUrl,
  readSpecsFile,
  resolveSpecsFilePath,
};

function normalizeReadArguments(rawArguments: string): ReadSpecsFileArguments | BoardChatAssistOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'read_specs_file arguments must be valid JSON',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'read_specs_file arguments must be an object',
    };
  }

  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.path !== 'string' || candidate.path.trim() === '') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'read_specs_file.path must be a non-empty string',
    };
  }

  return { path: candidate.path.trim() };
}

export async function readSpecsFileTool({
  board,
  toolCall,
  model: _model,
  usage: _usage,
}: ReadSpecsFileInput): Promise<BoardChatAssistOutput> {
  const normalized = normalizeReadArguments(toolCall.function.arguments);
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
    const repo = await readSpecsFileDeps.downloadRepositoryFromProjectUrl({
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

  const resolved = readSpecsFileDeps.resolveSpecsFilePath({ repoPath, filePath: normalizedPath });
  if (!resolved.ok) {
    return {
      status: 422,
      name: 'invalid-specs-path',
      message: resolved.reason,
    };
  }

  try {
    const file = await readSpecsFileDeps.readSpecsFile({ absolutePath: resolved.absolutePath });
    return {
      status: 200,
      data: {
        model: _model,
        message: `File \`${normalizedPath}\` (${String(file.sizeBytes)} bytes):\n\n\`\`\`markdown\n${file.content}\n\`\`\``,
      },
    };
  } catch (err) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        status: 404,
        name: 'specs-file-not-found',
        message: `File \`${normalizedPath}\` does not exist in the repository.`,
      };
    }
    return {
      status: 500,
      name: 'specs-file-read-failed',
      message: err instanceof Error ? err.message : 'Failed to read specs file',
    };
  }
}
