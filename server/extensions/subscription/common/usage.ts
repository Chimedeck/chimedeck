// Workspace usage aggregation.
// Computes current consumption of workspace-bounded resources.

import { db } from '../../../common/db';

export interface WorkspaceUsage {
  boardsPerWorkspace: number;
  boardsTotal: number;
  columnsPerBoard: number;
  cardsPerBoard: number;
  invitedMembersPerBoard: number;
  guestsPerBoard: number;
  storageBytes: number;
}

/**
 * Get board count for a specific workspace.
 */
export async function getBoardCountPerWorkspace(workspaceId: string): Promise<number> {
  const result = await db('boards')
    .where({ workspace_id: workspaceId })
    .count('boards.id as count')
    .first<{ count: number | string }>();
  return Number(result?.count || 0);
}

/**
 * Get total board count (aggregate across workspace).
 */
export async function getBoardCountTotal(workspaceId: string): Promise<number> {
  const workspace = await db('workspaces')
    .where({ id: workspaceId })
    .select('owner_id')
    .first<{ owner_id: string }>();

  if (!workspace?.owner_id) return getBoardCountPerWorkspace(workspaceId);

  const result = await db('boards as b')
    .join('workspaces as w', 'b.workspace_id', 'w.id')
    .where({ 'w.owner_id': workspace.owner_id })
    .count('b.id as count')
    .first<{ count: number | string }>();

  return Number(result?.count || 0);
}

/**
 * Get maximum column count in any board within workspace.
 */
export async function getMaxColumnsPerBoard(workspaceId: string): Promise<number> {
  const result = await db('lists')
    .select(db.raw('COUNT(lists.id) as col_count'))
    .join('boards', 'lists.board_id', 'boards.id')
    .where({ 'boards.workspace_id': workspaceId })
    .groupBy('lists.board_id')
    .orderBy(db.raw('col_count'), 'desc')
    .first<{ col_count: number | string }>();
  return Number(result?.col_count || 0);
}

/**
 * Get maximum card count in any board within workspace.
 */
export async function getMaxCardsPerBoard(workspaceId: string): Promise<number> {
  const result = await db('cards')
    .select(db.raw('COUNT(cards.id) as card_count'))
    .join('lists', 'cards.list_id', 'lists.id')
    .join('boards', 'lists.board_id', 'boards.id')
    .where({ 'boards.workspace_id': workspaceId })
    .groupBy('lists.board_id')
    .orderBy(db.raw('card_count'), 'desc')
    .first<{ card_count: number | string }>();
  return Number(result?.card_count || 0);
}

/**
 * Get the count of active (non-archived) lists for a specific board.
 * Used to enforce the maxColumnsPerBoard quota at list creation time.
 */
export async function getColumnCountForBoard(boardId: string): Promise<number> {
  const result = await db('lists')
    .where({ board_id: boardId, archived: false })
    .count('id as count')
    .first<{ count: number | string }>();
  return Number(result?.count || 0);
}

/**
 * Get maximum invited members in any board within workspace.
 */
export async function getMaxInvitedMembersPerBoard(workspaceId: string): Promise<number> {
  const result = await db('board_members')
    .select(db.raw('COUNT(board_members.id) as member_count'))
    .join('boards', 'board_members.board_id', 'boards.id')
    .where({ 'boards.workspace_id': workspaceId })
    .groupBy('board_members.board_id')
    .orderBy(db.raw('member_count'), 'desc')
    .first<{ member_count: number | string }>();
  return Number(result?.member_count || 0);
}

/**
 * Get the count of explicit members on a specific board.
 */
export async function getInvitedMemberCountForBoard(boardId: string): Promise<number> {
  const result = await db('board_members')
    .where({ board_id: boardId })
    .count('id as count')
    .first<{ count: number | string }>();
  return Number(result?.count || 0);
}

/**
 * Get maximum guests in any board within workspace.
 */
export async function getMaxGuestsPerBoard(workspaceId: string): Promise<number> {
  const result = await db('board_guest_access')
    .select(db.raw('COUNT(board_guest_access.id) as guest_count'))
    .join('boards', 'board_guest_access.board_id', 'boards.id')
    .where({ 'boards.workspace_id': workspaceId })
    .groupBy('board_guest_access.board_id')
    .orderBy(db.raw('guest_count'), 'desc')
    .first<{ guest_count: number | string }>();
  return Number(result?.guest_count || 0);
}

/**
 * Get the count of explicit guests on a specific board.
 */
export async function getGuestCountForBoard(boardId: string): Promise<number> {
  const result = await db('board_guest_access')
    .where({ board_id: boardId })
    .count('id as count')
    .first<{ count: number | string }>();
  return Number(result?.count || 0);
}

/**
 * Get total storage used by attachments in workspace.
 */
export async function getStorageBytesUsed(workspaceId: string): Promise<number> {
  const workspace = await db('workspaces')
    .where({ id: workspaceId })
    .select('owner_id')
    .first<{ owner_id: string }>();

  if (!workspace?.owner_id) return 0;

  const result = await db('attachments')
    .select(db.raw('COALESCE(SUM(size_bytes), 0) as total_bytes'))
    .join('cards', 'attachments.card_id', 'cards.id')
    .join('lists', 'cards.list_id', 'lists.id')
    .join('boards', 'lists.board_id', 'boards.id')
    .join('workspaces', 'boards.workspace_id', 'workspaces.id')
    .where({ 'workspaces.owner_id': workspace.owner_id })
    .first<{ total_bytes: number }>();
  return Number(result?.total_bytes || 0);
}

/**
 * Aggregate all usage metrics for workspace.
 */
export async function getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsage> {
  const [
    boardsPerWorkspace,
    boardsTotal,
    columnsPerBoard,
    cardsPerBoard,
    invitedMembersPerBoard,
    guestsPerBoard,
    storageBytes,
  ] = await Promise.all([
    getBoardCountPerWorkspace(workspaceId),
    getBoardCountTotal(workspaceId),
    getMaxColumnsPerBoard(workspaceId),
    getMaxCardsPerBoard(workspaceId),
    getMaxInvitedMembersPerBoard(workspaceId),
    getMaxGuestsPerBoard(workspaceId),
    getStorageBytesUsed(workspaceId),
  ]);

  return {
    boardsPerWorkspace,
    boardsTotal,
    columnsPerBoard,
    cardsPerBoard,
    invitedMembersPerBoard,
    guestsPerBoard,
    storageBytes,
  };
}
