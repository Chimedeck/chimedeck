// POST /api/v1/workspaces — create a new workspace; caller becomes OWNER.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

export async function handleCreateWorkspace(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const { currentUser } = req as AuthenticatedRequest;

  let body: { name?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    return Response.json(
      { error: { code: 'bad-request', message: 'name is required' } },
      { status: 400 },
    );
  }

  const id = randomUUID();
  const name = body.name.trim();

  await db.transaction(async (trx) => {
    await trx('workspaces').insert({
      id,
      name,
      owner_id: currentUser!.id,
    });

    // Caller automatically becomes OWNER.
    await trx('memberships').insert({
      user_id: currentUser!.id,
      workspace_id: id,
      role: 'OWNER',
    });
  });

  const workspace = await db('workspaces').where({ id }).first();

  return Response.json({
    data: {
      id: workspace.id,
      name: workspace.name,
      ownerId: workspace.owner_id,
      createdAt: workspace.created_at,
    },
  }, { status: 201 });
}
