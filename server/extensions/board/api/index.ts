// Board API router — mounts all board routes.
import { applyBoardVisibility } from '../../../middlewares/boardVisibility';
import { handleCreateBoard } from './create';
import { handleListBoards } from './list';
import { handleGetBoard } from './get';
import { handleUpdateBoard } from './update';
import { handlePatchBoard } from './patch';
import { handleArchiveBoard } from './archive';
import { handleDeleteBoard } from './delete';
import { handleDuplicateBoard } from './duplicate';
import { handleGetBoardEvents } from '../../realtime/api/events';
import { handleGetPresence } from '../../realtime/api/presence';
import { handleGetBoardLabels, handleCreateBoardLabel } from './labels';
import { handleGetBoardMembers, handleAddBoardMember, handleUpdateBoardMember, handleRemoveBoardMember } from './members';
import { handleJoinBoard } from './members/join';
import { handleGetMemberSuggestions } from './members/suggestions';
import { handleStarBoard, handleUnstarBoard } from './star';
import { handleFollowBoard, handleUnfollowBoard } from './follow';
import { handleGetMeStarredBoards } from './me-starred-boards';
import { handleGetBoardActivity } from './activity';
import { handleGetBoardComments } from './comments';
import { handleGetBoardActivities } from './boardActivities';
import { handleGetArchivedCards } from './archived-cards';
import { handleInviteGuest, handleRevokeGuest, handleListGuests, handleUpdateGuestType } from './guests/index';
import { handleGetWorkspaceBoards } from './workspaceBoards';
import { handleUploadBackground } from './uploadBackground';
import { handleDeleteBackground } from './deleteBackground';
import { handleGetBackground } from './backgroundProxy';
import { handleGetChatPermissions, handlePatchChatPermissions } from './chatPermissions/index';
import { handleGetChatMessages } from './chatMessages/index';
import { handleCreateChatMessage } from './chatMessages/index';
import { handleCreateChatSearch } from './chatSearch/index';
import { handleCreateChatAssist } from './chatAssist/index';
import { handleGetBoardIntegrations, handlePatchBoardIntegrations } from './integrations/index';
import { handleLoadSpecsManifest, handleReadSpecsFile } from './specs/index';
import { handlePutSpecsFile, handleCommitSpecs } from './github/specs/index';
import { resolveBoardId } from '../../../common/ids/resolveEntityId';

// Returns a Response if the path matches a board route, otherwise null.
export async function boardRouter(req: Request, pathname: string): Promise<Response | null> {
  // GET /api/v1/me/starred-boards — starred boards for the current user
  if (pathname === '/api/v1/me/starred-boards' && req.method === 'GET') {
    return handleGetMeStarredBoards(req);
  }

  // Workspace-scoped board routes: POST /api/v1/workspaces/:id/boards, GET /api/v1/workspaces/:id/boards
  const workspaceBoardsMatch = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/boards$/);
  if (workspaceBoardsMatch) {
    const workspaceId = workspaceBoardsMatch[1] as string;

    if (req.method === 'POST') return handleCreateBoard(req, workspaceId);
    if (req.method === 'GET') return handleListBoards(req, workspaceId);
  }

  // Board-scoped routes: /api/v1/boards/:id[/sub]
  const boardMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)(\/.*)?$/);
  if (boardMatch) {
    const boardIdentifier = boardMatch[1] as string;
    const boardId = await resolveBoardId(boardIdentifier);
    if (!boardId) {
      return Response.json(
        { error: { code: 'board-not-found', message: 'Board not found' } },
        { status: 404 },
      );
    }
    const sub = boardMatch[2] ?? '';

    // Enforce board visibility before dispatching to any board-scoped handler.
    // Populates req.board (and req.currentUser, req.workspaceId, req.callerRole for non-public boards).
    const visibilityError = await applyBoardVisibility(req, boardId);
    if (visibilityError) return visibilityError;

    // GET /api/v1/boards/:id
    if (sub === '' && req.method === 'GET') return handleGetBoard(req, boardId);

    // PATCH /api/v1/boards/:id — supports title and monetization_type
    if (sub === '' && req.method === 'PATCH') return handlePatchBoard(req, boardId);

    // DELETE /api/v1/boards/:id
    if (sub === '' && req.method === 'DELETE') return handleDeleteBoard(req, boardId);

    // PATCH /api/v1/boards/:id/archive
    if (sub === '/archive' && req.method === 'PATCH') return handleArchiveBoard(req, boardId);

    // POST /api/v1/boards/:id/duplicate
    if (sub === '/duplicate' && req.method === 'POST') return handleDuplicateBoard(req, boardId);

    // GET /api/v1/boards/:id/events?since=
    if (sub.startsWith('/events') && req.method === 'GET') return handleGetBoardEvents(req, boardId);

    // GET /api/v1/boards/:id/presence
    if (sub === '/presence' && req.method === 'GET') return handleGetPresence(req, boardId);

    // GET /api/v1/boards/:id/labels — list workspace labels accessible from board
    if (sub === '/labels' && req.method === 'GET') return handleGetBoardLabels(req, boardId);

    // POST /api/v1/boards/:id/labels — create a label in the board's workspace
    if (sub === '/labels' && req.method === 'POST') return handleCreateBoardLabel(req, boardId);

    // GET /api/v1/boards/:id/members — list explicit board members
    if (sub === '/members' && req.method === 'GET') return handleGetBoardMembers(req, boardId);

    // POST /api/v1/boards/:id/members — add a workspace member to the board
    if (sub === '/members' && req.method === 'POST') return handleAddBoardMember(req, boardId);

    // GET /api/v1/boards/:id/members/suggestions?q=
    if (sub === '/members/suggestions' && req.method === 'GET') return handleGetMemberSuggestions(req, boardId);

    // POST /api/v1/boards/:id/members/join — self-join a WORKSPACE or PUBLIC board
    if (sub === '/members/join' && req.method === 'POST') return handleJoinBoard(req, boardId);

    // Member sub-routes: PATCH/DELETE /api/v1/boards/:id/members/:userId
    const boardMemberMatch = sub.match(/^\/members\/([^/]+)$/);
    if (boardMemberMatch) {
      const targetUserId = boardMemberMatch[1] as string;
      if (req.method === 'PATCH') return handleUpdateBoardMember(req, boardId, targetUserId);
      if (req.method === 'DELETE') return handleRemoveBoardMember(req, boardId, targetUserId);
    }

    // POST /api/v1/boards/:id/star — star a board (idempotent)
    if (sub === '/star' && req.method === 'POST') return handleStarBoard(req, boardId);

    // DELETE /api/v1/boards/:id/star — unstar a board (idempotent)
    if (sub === '/star' && req.method === 'DELETE') return handleUnstarBoard(req, boardId);

    // POST /api/v1/boards/:id/follow — follow a board (idempotent)
    if (sub === '/follow' && req.method === 'POST') return handleFollowBoard(req, boardId);

    // DELETE /api/v1/boards/:id/follow — unfollow a board (idempotent)
    if (sub === '/follow' && req.method === 'DELETE') return handleUnfollowBoard(req, boardId);

    // GET /api/v1/boards/:id/activity — paginated activity feed for the board
    if (sub === '/activity' && req.method === 'GET') return handleGetBoardActivity(req, boardId);

    // GET /api/v1/boards/:id/comments — paginated comments across all cards in the board
    if (sub === '/comments' && req.method === 'GET') return handleGetBoardComments(req, boardId);

    // GET /api/v1/boards/:id/activities — merged activity + comments timeline, sorted by created_at
    if (sub === '/activities' && req.method === 'GET') return handleGetBoardActivities(req, boardId);

    // GET /api/v1/boards/:id/archived-cards — all archived cards in the board
    if (sub === '/archived-cards' && req.method === 'GET') return handleGetArchivedCards(req, boardId);

    // POST /api/v1/boards/:id/guests — invite a user as a guest (ADMIN+ only)
    if (sub === '/guests' && req.method === 'POST') return handleInviteGuest(req, boardId);

    // GET /api/v1/boards/:id/guests — list current board guests
    if (sub === '/guests' && req.method === 'GET') return handleListGuests(req, boardId);

    // DELETE /api/v1/boards/:id/guests/:userId — revoke guest access
    // PATCH /api/v1/boards/:id/guests/:userId — update guest type (ADMIN+ only)
    const guestUserMatch = sub.match(/^\/guests\/([^/]+)$/);
    if (guestUserMatch) {
      const targetUserId = guestUserMatch[1] as string;
      if (req.method === 'DELETE') return handleRevokeGuest(req, boardId, targetUserId);
      if (req.method === 'PATCH') return handleUpdateGuestType(req, boardId, targetUserId);
    }

    // GET /api/v1/boards/:id/workspace/boards — list all ACTIVE boards in the same workspace
    if (sub === '/workspace/boards' && req.method === 'GET') return handleGetWorkspaceBoards(req, boardId);

    // GET /api/v1/boards/:id/background — stream S3 background through auth proxy
    if (sub === '/background' && req.method === 'GET') return handleGetBackground(req, boardId);

    // POST /api/v1/boards/:id/background — upload a background image (Owner/Admin only)
    if (sub === '/background' && req.method === 'POST') return handleUploadBackground(req, boardId);

    // DELETE /api/v1/boards/:id/background — remove the background image (Owner/Admin only)
    if (sub === '/background' && req.method === 'DELETE') return handleDeleteBackground(req, boardId);

    // GET /api/v1/boards/:id/chat-permissions — read board chat permission settings
    if (sub === '/chat-permissions' && req.method === 'GET') return handleGetChatPermissions(req, boardId);

    // PATCH /api/v1/boards/:id/chat-permissions — update guest chat toggles (ADMIN/OWNER only)
    if (sub === '/chat-permissions' && req.method === 'PATCH') return handlePatchChatPermissions(req, boardId);

    // GET /api/v1/boards/:id/settings/integrations — read board integration settings
    if (sub === '/settings/integrations' && req.method === 'GET') return handleGetBoardIntegrations(req, boardId);

    // PATCH /api/v1/boards/:id/settings/integrations — update board integration settings
    if (sub === '/settings/integrations' && req.method === 'PATCH') return handlePatchBoardIntegrations(req, boardId);

    // POST /api/v1/boards/:id/chat/messages — persist a board chat message
    if (sub === '/chat/messages' && req.method === 'POST') return handleCreateChatMessage(req, boardId);

    // GET /api/v1/boards/:id/chat/messages — load board chat history
    if (sub === '/chat/messages' && req.method === 'GET') return handleGetChatMessages(req, boardId);

    // POST /api/v1/boards/:id/chat/search — semantic board-chat retrieval
    if (sub === '/chat/search' && req.method === 'POST') return handleCreateChatSearch(req, boardId);

    // POST /api/v1/boards/:id/chat/assist — board-chat assist response
    if (sub === '/chat/assist' && req.method === 'POST') return handleCreateChatAssist(req, boardId);

    // GET /api/v1/boards/:id/specs/manifest — load specs manifest (members only)
    if (sub === '/specs/manifest' && req.method === 'GET') return handleLoadSpecsManifest(req, boardId);

    // GET /api/v1/boards/:id/specs/files?path=... — read a single specs file (members only)
    if (sub === '/specs/files' && req.method === 'GET') return handleReadSpecsFile(req, boardId);

    // PUT /api/v1/boards/:id/github/specs/file — delta-save a markdown file
    if (sub === '/github/specs/file' && req.method === 'PUT') return handlePutSpecsFile(req, boardId);

    // POST /api/v1/boards/:id/github/specs/commit — stage and commit specs changes
    if (sub === '/github/specs/commit' && req.method === 'POST') return handleCommitSpecs(req, boardId);
  }

  return null;
}
