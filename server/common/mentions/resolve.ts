// Resolves @mention tokens to user records, scoped to board participants.
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

  const idTokens = nicknames.filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

  const users = (await db('users')
    // [why] Mentions are board-scoped: include explicit board members and
    // board guests, but exclude unrelated workspace users.
    .where((builder) => {
      builder
        .whereExists(
          db('board_members')
            .select(db.raw('1'))
            .whereRaw('board_members.user_id = users.id')
            .andWhere('board_members.board_id', boardId),
        )
        .orWhereExists(
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
