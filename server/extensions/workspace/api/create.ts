// POST /api/v1/workspaces — create a new workspace; caller becomes OWNER.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { env } from '../../../config/env';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import type { SubscriptionTier } from '../../subscription/common/types';

type OwnedWorkspaceTierRow = {
  workspaceId: string;
  tier: SubscriptionTier | null;
};

export function findBlockingFreeOwnedWorkspace(rows: OwnedWorkspaceTierRow[]): string | null {
  const blocking = rows.find((row) => (row.tier ?? 'tier_1') === 'tier_1');
  return blocking?.workspaceId ?? null;
}

async function resolveBlockingFreeOwnedWorkspace(userId: string): Promise<string | null> {
  if (!env.SUBSCRIPTIONS_ENABLED) return null;

  const rows = await db('workspaces as w')
    .leftJoin('workspace_subscriptions as ws', 'w.id', 'ws.workspace_id')
    .where('w.owner_id', userId)
    .select<{ workspaceId: string; tier: SubscriptionTier | null }[]>(
      'w.id as workspaceId',
      'ws.tier as tier',
    );

  return findBlockingFreeOwnedWorkspace(rows);
}

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

  const blockingWorkspaceId = await resolveBlockingFreeOwnedWorkspace(currentUser!.id);
  if (blockingWorkspaceId) {
    return Response.json(
      {
        error: {
          code: 'workspace-creation-blocked-by-free-owned-workspace',
          message: 'Upgrade your existing free workspace to create another workspace.',
          data: {
            workspaceId: blockingWorkspaceId,
            upgradeUrl: `/workspace/${blockingWorkspaceId}/billing`,
          },
        },
      },
      { status: 402 },
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
