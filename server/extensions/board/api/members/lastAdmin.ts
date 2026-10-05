// Shared last-board-admin invariant.
//
// A board must always keep at least one ADMIN. Four routes can break that:
//   PATCH  /api/v1/boards/:id/members/:userId        (demote)
//   DELETE /api/v1/boards/:id/members/:userId        (remove)
//   PUT    /1/boards/:id/members/:idMember           (Trello compat, demote)
//   DELETE /1/boards/:id/members/:idMember           (Trello compat, remove)
//
// The check is identical in all four, so it lives here rather than being
// copied per route.
import { db } from '../../../../common/db';

type BoardMemberRow = { board_id: string; user_id: string; role: string };
type CountRow = { count: string | number };

/**
 * True when this change would leave the board with no ADMIN.
 *
 * `nextRole` is the role the member would end up with; pass `null` when they
 * are being removed from the board entirely. Returns false when the member
 * does not exist, is not an ADMIN, or stays an ADMIN — callers handle the
 * not-found case themselves.
 */
export async function wouldRemoveLastBoardAdmin(
  boardId: string,
  userId: string,
  nextRole: string | null,
): Promise<boolean> {
  const existing = await db<BoardMemberRow>('board_members')
    .where({ board_id: boardId, user_id: userId })
    .first<BoardMemberRow | undefined>();

  // Not a member, or not an admin: this change cannot remove the last admin.
  if (!existing || existing.role !== 'ADMIN') return false;

  // Still an admin afterwards: nothing is lost.
  if (nextRole === 'ADMIN') return false;

  const adminCount = await db('board_members')
    .where({ board_id: boardId, role: 'ADMIN' })
    .count('id as count')
    .first<CountRow | undefined>();

  return Number(adminCount?.count ?? 0) <= 1;
}

export const LAST_BOARD_ADMIN_DEMOTE_MESSAGE =
  'Cannot demote the last board admin. Promote another member first.';

export const LAST_BOARD_ADMIN_REMOVE_MESSAGE =
  'Cannot remove the last board admin. Promote another member to ADMIN first.';
