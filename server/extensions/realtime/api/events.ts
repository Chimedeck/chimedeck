// server/extensions/realtime/api/events.ts
// GET /api/v1/boards/:id/events?since=<sequence>
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { readEventsSince } from '../../../mods/events/read';

export async function handleGetBoardEvents(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json({ name: 'board-not-found', data: { message: 'Board not found' } }, { status: 404 });
  }

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get('since') ?? '0';
  const since = isNaN(Number(sinceParam)) ? 0 : Number(sinceParam);

  const events = await readEventsSince({ boardId, since, limit: 100 });
  const hasMore = events.length === 100;
  const latestSequence = events.length > 0 ? events[events.length - 1]!.sequence.toString() : sinceParam;

  const serialized = events.map((e) => ({
    ...e,
    sequence: e.sequence.toString(),
  }));

  return Response.json({
    data: serialized,
    metadata: { hasMore, latestSequence },
  });
}
