// Resolves @mention tokens to user records.
// Scope rules:
// - PRIVATE boards: explicit board participants only (members + guests).
// - WORKSPACE/PUBLIC boards: any non-guest workspace member, plus board guests.
// Supports both @nickname and @<user-id> tokens so users without nicknames can
// still be resolved from serialized mentions.
import { db } from '../db';

interface User {
  id: string;
  nickname: string | null;
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

  const board = await db('boards')
    .where({ id: boardId })
    .select('workspace_id', 'visibility')
    .first();

  if (!board) return [];

  const idTokens = nicknames.filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

  const users = (await db('users')
    // [why] Mention scope depends on board visibility.
    .where((builder) => {
      if (board.visibility === 'PRIVATE') {
        builder.whereExists(
          db('board_members')
            .select(db.raw('1'))
            .whereRaw('board_members.user_id = users.id')
            .andWhere('board_members.board_id', boardId),
        );
      } else {
        builder.whereExists(
          db('memberships')
            .select(db.raw('1'))
            .whereRaw('memberships.user_id = users.id')
            .andWhere('memberships.workspace_id', board.workspace_id)
            .whereNot('memberships.role', 'GUEST'),
        );
      }

      builder.orWhereExists(
        db('board_guest_access')
          .select(db.raw('1'))
          .whereRaw('board_guest_access.user_id = users.id')
          .andWhere('board_guest_access.board_id', boardId),
      );
    })
    .where((builder) => {
      builder.whereIn('users.nickname', nicknames);
      if (idTokens.length > 0) {
        builder.orWhereIn('users.id', idTokens);
      }
    })
    .select(
      'users.id',
      'users.nickname',
      'users.name',
      'users.email',
      'users.avatar_url',
    )) as User[];

  return users;
}
