// Workspace usage aggregation.
// Computes current consumption of workspace-bounded resources.

import { db } from '../../../common/db';

export interface WorkspaceUsage {
  workspaceCount: number;
  boardsPerWorkspace: number;
  boardsTotal: number;
  columnsPerBoard: number;
  invitedMembersPerBoard: number;
  guestsPerBoard: number;
  storageBytes: number;
}

/**
 * Get the number of workspaces for a user or current user.
 * For now, counts total active workspaces (can be refined by userId later).
 */
export async function getWorkspaceCount(): Promise<number> {
  const result = await db('workspaces')
    .where({ is_archived: false })
    .count('id as count')
    .first<{ count: number | string }>();
  return Number(result?.count || 0);
}

/**
 * Get board count for a specific workspace.
 */
export async function getBoardCountPerWorkspace(workspaceId: string): Promise<number> {
  const result = await db('boards')
    .where({ workspace_id: workspaceId, is_archived: false })
    .count('id as count')
    .first<{ count: number | string }>();
  return Number(result?.count || 0);
}

/**
 * Get total board count (aggregate across workspace).
 */
export async function getBoardCountTotal(workspaceId: string): Promise<number> {
  const result = await db('boards')
    .where({ workspace_id: workspaceId, is_archived: false })
    .count('id as count')
    .first<{ count: number | string }>();
  return Number(result?.count || 0);
}

/**
 * Get maximum column count in any board within workspace.
 */
export async function getMaxColumnsPerBoard(workspaceId: string): Promise<number> {
  const result = await db('lists')
    .select(db.raw('COUNT(id) as col_count'))
    .join('boards', 'lists.board_id', 'boards.id')
    .where({ 'boards.workspace_id': workspaceId, 'lists.is_archived': false })
    .groupBy('lists.board_id')
    .orderBy(db.raw('col_count'), 'desc')
    .first<{ col_count: number | string }>();
  return Number(result?.col_count || 0);
}

/**
 * Get maximum invited members in any board within workspace.
 */
export async function getMaxInvitedMembersPerBoard(workspaceId: string): Promise<number> {
  const result = await db('board_members')
    .select(db.raw('COUNT(id) as member_count'))
    .join('boards', 'board_members.board_id', 'boards.id')
    .where({ 'boards.workspace_id': workspaceId })
    .groupBy('board_members.board_id')
    .orderBy(db.raw('member_count'), 'desc')
    .first<{ member_count: number | string }>();
  return Number(result?.member_count || 0);
}

/**
 * Get maximum guests in any board within workspace.
 */
export async function getMaxGuestsPerBoard(workspaceId: string): Promise<number> {
  const result = await db('board_guest_access')
    .select(db.raw('COUNT(id) as guest_count'))
    .join('boards', 'board_guest_access.board_id', 'boards.id')
    .where({ 'boards.workspace_id': workspaceId })
    .groupBy('board_guest_access.board_id')
    .orderBy(db.raw('guest_count'), 'desc')
    .first<{ guest_count: number | string }>();
  return Number(result?.guest_count || 0);
}

/**
 * Get total storage used by attachments in workspace.
 */
export async function getStorageBytesUsed(workspaceId: string): Promise<number> {
  const result = await db('attachments')
    .select(db.raw('COALESCE(SUM(size_bytes), 0) as total_bytes'))
    .join('cards', 'attachments.card_id', 'cards.id')
    .join('lists', 'cards.list_id', 'lists.id')
    .join('boards', 'lists.board_id', 'boards.id')
    .where({ 'boards.workspace_id': workspaceId, 'attachments.is_deleted': false })
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
    invitedMembersPerBoard,
    guestsPerBoard,
    storageBytes,
  ] = await Promise.all([
    getBoardCountPerWorkspace(workspaceId),
    getBoardCountTotal(workspaceId),
    getMaxColumnsPerBoard(workspaceId),
    getMaxInvitedMembersPerBoard(workspaceId),
    getMaxGuestsPerBoard(workspaceId),
    getStorageBytesUsed(workspaceId),
  ]);

  return {
    workspaceCount: 1,
    boardsPerWorkspace,
    boardsTotal,
    columnsPerBoard,
    invitedMembersPerBoard,
    guestsPerBoard,
    storageBytes,
  };
}
