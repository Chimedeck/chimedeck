// listSpecsFiles — tool definition and handler for listing all specs markdown files
// in the board's linked GitHub repository. Executes immediately (not a proposal).
import { listSpecsFiles } from '../../specs/list';
import { downloadRepositoryFromProjectUrl } from '../../githubRepository/downloadRepositoryFromProjectUrl';
import type {
  BoardChatAssistToolDefinition,
  BoardChatAssistToolCall,
  BoardChatAssistOutput,
} from '../../../types';

export const LIST_SPECS_FILES_TOOL: BoardChatAssistToolDefinition = {
  type: 'function',
  function: {
    name: 'list_specs_files',
    description:
      "List all markdown documentation files under specs/ in the board's linked GitHub repository. Use this to discover what documentation already exists before proposing changes.",
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
};

export interface ListSpecsFilesInput {
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

export const listSpecsFilesDeps = {
  downloadRepositoryFromProjectUrl,
  listSpecsFiles,
};

export async function listSpecsFilesTool({
  board,
  toolCall: _toolCall,
  model: _model,
  usage: _usage,
}: ListSpecsFilesInput): Promise<BoardChatAssistOutput> {
  if (!board.github_project_url) {
    return {
      status: 400,
      name: 'no-github-project-url',
      message: 'This board does not have a linked GitHub repository.',
    };
  }

  let repoPath: string;
  try {
    const repo = await listSpecsFilesDeps.downloadRepositoryFromProjectUrl({
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
    const files = await listSpecsFilesDeps.listSpecsFiles({ repoPath });
    if (files.length === 0) {
      return {
        status: 200,
        data: {
          model: _model,
          message: 'No specs files found in the repository.',
        },
      };
    }

    const fileList = files
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((f) => `- \`${f.path}\` (${String(f.sizeBytes)} bytes)`)
      .join('\n');

    return {
      status: 200,
      data: {
        model: _model,
        message: `Found ${String(files.length)} specs file(s):\n\n${fileList}`,
      },
    };
  } catch (err) {
    return {
      status: 500,
      name: 'specs-list-failed',
      message: err instanceof Error ? err.message : 'Failed to list specs files',
    };
  }
}
