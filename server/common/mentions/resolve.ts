// Resolves @mention nicknames to user records, scoped to board membership.
// Only returns users who are members of the specified board's workspace.
import { db } from '../db';

interface User {
  id: string;
  nickname: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
}

export async function resolveNicknames({
  nicknames,
  boardId,
}: {
  nicknames: string[];
  boardId: string;
}): Promise<User[]> {
  if (nicknames.length === 0) return [];

  const board = await db('boards').where({ id: boardId }).first('workspace_id');
  if (!board) return [];

  const users = await db('users')
    .join('memberships', 'users.id', 'memberships.user_id')
    .where('memberships.workspace_id', board.workspace_id)
    .whereIn('users.nickname', nicknames)
    .select(
      'users.id',
      'users.nickname',
      'users.name',
      'users.email',
      'users.avatar_url',
    );

  return users;
}
