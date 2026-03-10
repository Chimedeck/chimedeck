// DB access for user_board_view_prefs table.
import { db } from '../../common/db';
import { generateId } from '../../common/uuid';
import type { ViewType, ViewPreference } from './types';

export async function getViewPreference({
  userId,
  boardId,
}: {
  userId: string;
  boardId: string;
}): Promise<ViewPreference | null> {
  const row = await db('user_board_view_prefs')
    .where({ user_id: userId, board_id: boardId })
    .first();
  return row ?? null;
}

export async function upsertViewPreference({
  userId,
  boardId,
  viewType,
}: {
  userId: string;
  boardId: string;
  viewType: ViewType;
}): Promise<ViewPreference> {
  const now = new Date().toISOString();

  const existing = await db('user_board_view_prefs')
    .where({ user_id: userId, board_id: boardId })
    .first();

  if (existing) {
    const [updated] = await db('user_board_view_prefs')
      .where({ user_id: userId, board_id: boardId })
      .update({ view_type: viewType, updated_at: now })
      .returning('*');
    return updated as ViewPreference;
  }

  const [inserted] = await db('user_board_view_prefs')
    .insert({ id: generateId(), user_id: userId, board_id: boardId, view_type: viewType, updated_at: now })
    .returning('*');
  return inserted as ViewPreference;
}
