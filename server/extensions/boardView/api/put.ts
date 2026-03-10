// PUT /api/v1/boards/:id/view-preference
// Upserts the view type for the current user and board.
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { db } from '../../../common/db';
import { upsertViewPreference } from '../model';
import { VALID_VIEW_TYPES, type ViewType } from '../types';

export async function handlePutViewPreference(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  let body: { viewType?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const viewType = body?.viewType;

  if (!viewType || !VALID_VIEW_TYPES.includes(viewType as ViewType)) {
    return Response.json(
      { error: { code: 'invalid-view-type', message: `viewType must be one of: ${VALID_VIEW_TYPES.join(', ')}` } },
      { status: 400 },
    );
  }

  await upsertViewPreference({ userId, boardId, viewType: viewType as ViewType });

  return Response.json({ data: { viewType } });
}
