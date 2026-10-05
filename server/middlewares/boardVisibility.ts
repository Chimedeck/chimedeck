// boardVisibility.ts — enforces board visibility access rules.
//
// Access matrix:
// | Caller                                  | PRIVATE | WORKSPACE | PUBLIC   |
// |----------------------------------------|---------|-----------|----------|
// | Unauthenticated                         | 403     | 403       | read-only|
// | Workspace OWNER / ADMIN                 | allow   | allow     | allow    |
// | Workspace MEMBER with board_members row | allow   | allow     | allow    |
// | Workspace MEMBER without board_members  | 403     | allow     | allow    |
// | Workspace VIEWER with board_members row | allow   | allow     | allow    |
// | Workspace VIEWER without board_members  | 403     | allow     | allow    |
// | GUEST with board_guest_access row       | allow   | allow     | allow    |
// | GUEST without board_guest_access row    | 403     | 403       | allow    |
import { db } from '../common/db';
import { authenticate, type AuthenticatedRequest } from '../extensions/auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
  type Role,
} from './permissionManager';
import type { BoardVisibility, GuestType } from '../extensions/board/types';
import { resolveBoardId, resolveCardId, resolveListId } from '../common/ids/resolveEntityId';

type BoardRow = {
  id: string;
  workspace_id: string;
  title: string;
  state: string;
  visibility: BoardVisibility;
  description: string | null;
  background: string | null;
  monetization_type: string | null;
  created_at: string;
};

type ListRow = { id: string; board_id: string };
type CardRow = { id: string; list_id: string };
type ChecklistItemRow = { id: string; card_id: string };
type ChecklistRow = { id: string; card_id: string };
type GuestAccessRow = { user_id: string; board_id: string; guest_type: GuestType | null };
type BoardMemberRow = { user_id: string; board_id: string };
type AuthenticatedUserRequest = AuthenticatedRequest & { currentUser: { id: string } };
type RoleScopedRequest = WorkspaceScopedRequest & { callerRole: Role };

export interface BoardVisibilityScopedRequest extends WorkspaceScopedRequest {
  // Set when the authenticated caller is a GUEST; reflects their sub-type on this board.
  guestType?: GuestType;
  board?: BoardRow;
}

// Enforces board visibility access control on any board-scoped route.
// On success, attaches `board` to the request and (for non-public boards)
// also populates `currentUser`, `workspaceId`, and `callerRole` via the
// standard auth/membership chain so downstream handlers can call requireRole().
// Returns null on success, or an error Response.
export async function applyBoardVisibility(
  req: Request,
  boardId: string,
): Promise<Response | null> {
  const resolvedBoardId = await resolveBoardId(boardId);
  if (!resolvedBoardId) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  const board = await db<BoardRow>('boards').where({ id: resolvedBoardId }).first();

  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  (req as BoardVisibilityScopedRequest).board = board;

  // PUBLIC boards are read-accessible without a session token.
  if (board.visibility === 'PUBLIC') {
    return null;
  }

  // WORKSPACE and PRIVATE boards require an authenticated workspace member.
  const authReq = req as AuthenticatedUserRequest;
  const authError = await authenticate(authReq);
  if (authError) return authError;

  const scopedReq = req as RoleScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const callerRole = scopedReq.callerRole;
  const userId = authReq.currentUser.id;

  // Guests only have access to boards they have been explicitly invited to.
  // Applies to PRIVATE and WORKSPACE boards.
  if (callerRole === 'GUEST') {
    const guestAccess = await db<GuestAccessRow>('board_guest_access')
      .where({ user_id: userId, board_id: resolvedBoardId })
      .first();
    if (!guestAccess) {
      return Response.json(
        { error: { code: 'board-access-denied', message: 'You do not have access to this board' } },
        { status: 403 },
      );
    }
    // Attach guestType so downstream handlers can enforce VIEWER vs MEMBER write gates.
    (req as BoardVisibilityScopedRequest).guestType = guestAccess.guest_type ?? 'VIEWER';
    return null;
  }

  // OWNER and ADMIN bypass the board_members check — they can access any board.
  if (callerRole === 'OWNER' || callerRole === 'ADMIN') {
    return null;
  }

  // PRIVATE boards: workspace MEMBER and VIEWER require an explicit board_members entry.
  if (board.visibility === 'PRIVATE') {
    const boardMember = await db<BoardMemberRow>('board_members')
      .where({ user_id: userId, board_id: resolvedBoardId })
      .first();
    if (!boardMember) {
      return Response.json(
        { error: { code: 'board-access-denied', message: 'You do not have access to this board' } },
        { status: 403 },
      );
    }
  }

  // WORKSPACE boards: MEMBER and VIEWER are automatically allowed.
  return null;
}

// Looks up the board from the given list ID, then applies board visibility.
// Use this for list-scoped routes where boardId is not in the URL.
export async function applyBoardVisibilityFromList(
  req: Request,
  listId: string,
): Promise<Response | null> {
  const resolvedListId = await resolveListId(listId);
  const list = resolvedListId ? await db<ListRow>('lists').where({ id: resolvedListId }).first() : null;
  if (!list) {
    return Response.json(
      { error: { code: 'list-not-found', message: 'List not found' } },
      { status: 404 },
    );
  }
  return applyBoardVisibility(req, list.board_id);
}

// Looks up the board from the given card ID (via its list), then applies board visibility.
// Use this for card-scoped routes where boardId is not in the URL.
export async function applyBoardVisibilityFromCard(
  req: Request,
  cardId: string,
): Promise<Response | null> {
  const resolvedCardId = await resolveCardId(cardId);
  if (!resolvedCardId) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 },
    );
  }

  const card = await db<CardRow>('cards').where({ id: resolvedCardId }).first();
  if (!card) {
    return Response.json(
      { error: { code: 'card-not-found', message: 'Card not found' } },
      { status: 404 },
    );
  }
  const list = await db<ListRow>('lists').where({ id: card.list_id }).first();
  if (!list) {
    return Response.json(
      { error: { code: 'list-not-found', message: 'Card context not found' } },
      { status: 404 },
    );
  }
  return applyBoardVisibility(req, list.board_id);
}

// Looks up the board from the given checklist item ID (via card → list → board),
// then applies board visibility. Use this for /api/v1/checklist-items/:id routes.
export async function applyBoardVisibilityFromChecklistItem(
  req: Request,
  itemId: string,
): Promise<Response | null> {
  const item = await db<ChecklistItemRow>('checklist_items').where({ id: itemId }).first();
  if (!item) {
    return Response.json(
      { error: { code: 'checklist-item-not-found', message: 'Checklist item not found' } },
      { status: 404 },
    );
  }
  return applyBoardVisibilityFromCard(req, item.card_id);
}

// Looks up the board from the given checklist ID (via card → list → board),
// then applies board visibility. Use this for /api/v1/checklists/:id routes.
export async function applyBoardVisibilityFromChecklist(
  req: Request,
  checklistId: string,
): Promise<Response | null> {
  const checklist = await db<ChecklistRow>('checklists').where({ id: checklistId }).first();
  if (!checklist) {
    return Response.json(
      { error: { code: 'checklist-not-found', message: 'Checklist not found' } },
      { status: 404 },
    );
  }
  return applyBoardVisibilityFromCard(req, checklist.card_id);
}
