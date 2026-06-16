// POST /api/v1/boards/:boardId/chat/assist/commit
// Commits confirmed document proposals to the board's linked GitHub repository.
// The client sends back the proposals that the AI originally suggested and the
// user approved. Each proposal carries the server-generated idempotency key
// so duplicate commits are safe.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';
import { guestDeniedError } from '../../mods/guestPermissions';
import { downloadRepositoryFromProjectUrl } from '../../mods/githubRepository/downloadRepositoryFromProjectUrl';
import { writeSpecsFile } from '../../mods/specs/write';
import { commitSpecsChanges } from '../../mods/specs/commit';
import { normalizeGithubProjectUrl } from '../../mods/githubProjectUrl';
import { dispatchEvent } from '../../../../mods/events/dispatch';
import { invalidateSpecsCachesForBoard } from '../../mods/specs';
import type {
  BoardChatAssistActionCard,
  BoardChatAssistCommitProposal,
} from '../../types';

export const commitDocumentProposalsDeps = {
  authenticate,
  requireBoardAccess,
  requireWorkspaceMembership,
  requireRole,
  downloadRepositoryFromProjectUrl,
  writeSpecsFile,
  commitSpecsChanges,
  normalizeGithubProjectUrl,
  dispatchEvent,
  invalidateSpecsCachesForBoard,
};

function requireCommitAccess(req: WorkspaceScopedRequest): Response | null {
  if (req.callerRole === 'GUEST') {
    if (req.guestType === 'MEMBER') {
      return null;
    }
    return Response.json(
      {
        name: req.guestType === 'VIEWER'
          ? guestDeniedError('VIEWER')
          : 'guest-role-no-org-access',
        data: { message: 'Guest does not have permission to commit documents' },
      },
      { status: 403 },
    );
  }
  return requireRole(req, 'MEMBER');
}

function validateProposal(proposal: unknown): proposal is BoardChatAssistCommitProposal {
  if (!proposal || typeof proposal !== 'object') return false;
  const p = proposal as Record<string, unknown>;
  return (
    typeof p.toolCallId === 'string' && p.toolCallId.trim() !== ''
    && typeof p.idempotencyKey === 'string' && p.idempotencyKey.trim() !== ''
    && typeof p.path === 'string' && p.path.trim() !== ''
    && typeof p.content === 'string' && p.content.trim() !== ''
    && typeof p.commitMessage === 'string' && p.commitMessage.trim() !== ''
  );
}

interface CommitBoard {
  id: string;
  workspace_id: string;
  title: string;
  state: string;
  created_at: string;
  github_project_url?: string | null;
}

// [why] Parse and validate the proposals array from the request body.
function parseProposals(body: unknown): BoardChatAssistCommitProposal[] | Response {
  if (!body || typeof body !== 'object') {
    return Response.json({ name: 'invalid-request-body', data: { message: 'Request body must be JSON' } }, { status: 400 });
  }
  const raw = (body as { proposals?: unknown }).proposals;
  if (!Array.isArray(raw) || raw.length === 0) {
    return Response.json({ name: 'missing-proposals', data: { message: 'At least one proposal is required' } }, { status: 400 });
  }
  const filtered: BoardChatAssistCommitProposal[] = [];
  for (const item of raw) {
    if (validateProposal(item)) filtered.push(item);
  }
  if (filtered.length === 0) {
    return Response.json({ name: 'invalid-proposals', data: { message: 'No valid proposals found' } }, { status: 400 });
  }
  return filtered;
}

type CommitError = { path: string; name: string; message: string };
type CommittedEntry = { path: string; commitHash: string; actionCard: BoardChatAssistActionCard };
type CommitData = { committed: CommittedEntry[]; errors: CommitError[] };

// [why] Write each proposal's file to the local worktree. Returns changed file paths.
async function writeProposalFiles(
  proposals: BoardChatAssistCommitProposal[],
  repoPath: string,
  errors: CommitError[],
): Promise<string[]> {
  const changed: string[] = [];
  for (const proposal of proposals) {
    const normalizedPath = proposal.path.replace(/^\/+/, '');
    if (!normalizedPath.startsWith('specs/') || !normalizedPath.endsWith('.md')) {
      errors.push({ path: proposal.path, name: 'invalid-path', message: 'Path must start with specs/ and end with .md' });
      continue;
    }
    try {
      await commitDocumentProposalsDeps.writeSpecsFile({
        repoPath,
        filePath: normalizedPath,
        content: proposal.content,
        // [why] Pass '*' so the commit endpoint can overwrite files that already
        // exist from a previous turn. The user explicitly approved this proposal,
        // so there is no concurrent-edit conflict to guard against.
        ifMatch: '*',
      });
      changed.push(normalizedPath);
    } catch (err) {
      errors.push({ path: proposal.path, name: 'write-failed', message: err instanceof Error ? err.message : 'Failed to write file' });
    }
  }
  return changed;
}

// [why] Build the committed response entries and broadcast confirmed action cards.
function finalizeCommit(
  proposals: BoardChatAssistCommitProposal[],
  changedFiles: string[],
  commitHash: string,
  board: { id: string; workspace_id: string },
  actorId: string,
): { committed: CommittedEntry[] } {
  const committed: CommittedEntry[] = [];
  for (const proposal of proposals) {
    const normalizedPath = proposal.path.replace(/^\/+/, '');
    if (!changedFiles.includes(normalizedPath)) continue;

    const actionCard: BoardChatAssistActionCard = {
      state: 'confirmed',
      toolName: 'propose_github_document',
      toolCallId: proposal.toolCallId,
      idempotencyKey: proposal.idempotencyKey,
      source: 'board-chat-assist',
      boardId: board.id,
      workspaceId: board.workspace_id,
      documentPath: normalizedPath,
    };

    committed.push({ path: normalizedPath, commitHash, actionCard });

    commitDocumentProposalsDeps.dispatchEvent({
      type: 'board_chat.document_committed',
      boardId: board.id,
      entityId: proposal.idempotencyKey,
      actorId,
      payload: { actionCard },
    }).catch(() => {});
  }
  return { committed };
}

export async function handleCommitDocumentProposals(req: Request, boardId: string): Promise<Response> {
  const authError = await commitDocumentProposalsDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await commitDocumentProposalsDeps.requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;
  // [why] BoardScopedRequest.board has a minimal type; cast to include github_project_url
  const board = boardReq.board as CommitBoard | undefined;
  if (!board) return Response.json({ error: { code: 'board-context-missing' } }, { status: 500 });

  const workspaceReq = req as WorkspaceScopedRequest;
  const membershipError = await commitDocumentProposalsDeps.requireWorkspaceMembership(workspaceReq, board.workspace_id);
  if (membershipError) return membershipError;
  const commitAccessError = requireCommitAccess(workspaceReq);
  if (commitAccessError) return commitAccessError;

  if (!board.github_project_url) {
    return Response.json({ name: 'no-github-project-url', data: { message: 'This board does not have a linked GitHub repository.' } }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ name: 'invalid-request-body', data: { message: 'Request body must be JSON' } }, { status: 400 });
  }

  const proposalsOrError = parseProposals(body);
  if (proposalsOrError instanceof Response) return proposalsOrError;
  const proposals = proposalsOrError;

  const urlResult = commitDocumentProposalsDeps.normalizeGithubProjectUrl({ value: board.github_project_url });
  if (!urlResult.ok) {
    return Response.json({ name: 'invalid-github-project-url', data: { message: 'Invalid GitHub project URL' } }, { status: 400 });
  }

  const currentUser = (req as AuthenticatedRequest).currentUser;
  if (!currentUser) return Response.json({ error: { code: 'auth-missing' } }, { status: 401 });
  const actorId = currentUser.id;

  const repo = await commitDocumentProposalsDeps.downloadRepositoryFromProjectUrl({ projectUrl: board.github_project_url, boardId: board.id });

  const errors: CommitError[] = [];
  const changedFiles = await writeProposalFiles(proposals, repo.repoPath, errors);

  if (changedFiles.length === 0) {
    return Response.json({ data: { committed: [] as CommittedEntry[], errors } } satisfies { data: CommitData }, { status: 422 });
  }

  const commitMessage = proposals
    .filter((p) => changedFiles.includes(p.path.replace(/^\/+/, '')))
    .map((p) => p.commitMessage)
    .join('; ');
  const commitResult = await commitDocumentProposalsDeps.commitSpecsChanges({
    repoPath: repo.repoPath,
    branch: repo.ref,
    changedFiles,
    message: commitMessage || 'chore: update specs via board chat',
    actorId,
    boardId: board.id,
    botAlias: 'board-chat-assist',
  });

  const { committed } = finalizeCommit(proposals, changedFiles, commitResult.commitHash, board, actorId);
  return Response.json({ data: { committed, errors } satisfies CommitData });
}
