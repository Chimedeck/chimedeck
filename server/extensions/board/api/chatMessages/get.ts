// GET /api/v1/boards/:boardId/chat/messages
// Sprint 199 — optional sessionId query param to scope history to one session.
import { db } from '../../../../common/db';
import { buildAvatarProxyUrl } from '../../../../common/avatar/resolveAvatarUrl';
import { requireWorkspaceMembership, type WorkspaceScopedRequest } from '../../../../middlewares/permissionManager';
import { requireGuestCanViewBoardChat } from '../../middlewares/chatPermissions';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function handleGetChatMessages(req: Request, boardId: string): Promise<Response> {
  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const workspaceReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(workspaceReq, boardReq.board!.workspace_id);
  if (membershipError) return membershipError;

  const guestError = await requireGuestCanViewBoardChat(workspaceReq, boardId);
  if (guestError) return guestError;

  const url = new URL(req.url);
  const cursor = url.searchParams.get('cursor') ?? null;
  const sessionId = url.searchParams.get('sessionId') ?? null;
  const limitParam = Number.parseInt(url.searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Math.min(Number.isNaN(limitParam) || limitParam < 1 ? DEFAULT_LIMIT : limitParam, MAX_LIMIT);

  let query = db('board_chat_messages as m')
    .leftJoin('users as u', 'm.author_id', 'u.id')
    .where('m.board_id', boardId)
    .orderBy('m.created_at', 'asc')
    .orderBy('m.id', 'asc')
    .limit(limit + 1)
    .select(
      'm.id',
      'm.thread_id',
      'm.board_id',
      'm.author_id',
      'm.content',
      'm.is_assistant',
      'm.created_at',
      'm.updated_at',
      db.raw('COALESCE(u.name, u.email) as author_name'),
      'u.avatar_url as author_avatar_url',
    );

  // [why] Scope to a specific session when provided — keeps history bounded
  // and prevents token overload from cross-session context bleeding.
  if (sessionId) {
    query = query.where('m.thread_id', sessionId);
  }

  if (cursor) {
    const cursorQuery = db('board_chat_messages').where({ id: cursor, board_id: boardId });
    // [why] Only match cursor within the same session context.
    if (sessionId) {
      cursorQuery.where('thread_id', sessionId);
    }
    const cursorRow = await cursorQuery.first();
    if (cursorRow) {
      query = query.where(function () {
        this.where('m.created_at', '>', cursorRow.created_at).orWhere(function () {
          this.where('m.created_at', '=', cursorRow.created_at).andWhere('m.id', '>', cursor);
        });
      });
    }
  }

  const rows = await query;
  const hasMore = rows.length > limit;
  const data = (hasMore ? rows.slice(0, limit) : rows).map((row) => ({
    id: row.id,
    thread_id: row.thread_id,
    board_id: row.board_id,
    author_id: row.author_id,
    content: row.content,
    is_assistant: row.is_assistant,
    created_at: row.created_at,
    updated_at: row.updated_at,
    userName: row.is_assistant ? 'Board AI' : row.author_name,
    avatar: row.is_assistant
      ? null
      : buildAvatarProxyUrl({
          userId: row.author_id,
          avatarUrl: row.author_avatar_url ?? null,
        }),
  }));

  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.id : null;

  return Response.json({
    data,
    metadata: {
      cursor: nextCursor,
      hasMore,
    },
  });
}
