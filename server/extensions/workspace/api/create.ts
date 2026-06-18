// POST /api/v1/workspaces — create a new workspace; caller becomes OWNER.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { env } from '../../../config/env';
import { SUBSCRIPTION_TIERS } from '../../../config/subscription-tiers';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { getCurrentTierForUser } from '../../subscription/common/subscriptionRepo';

const TIER_NAME_MAP: Record<string, keyof typeof SUBSCRIPTION_TIERS> = {
  tier_1: 'personal',
  tier_2: 'hobby',
  tier_3: 'pro',
  tier_4: 'business',
  unlimited: 'enterprise',
};

/**
 * Returns the workspace ID to surface in the upgrade CTA when workspace creation is blocked,
 * or null if creation is allowed.
 *
 * Logic: resolve the caller's billing tier, then compare owned workspace count to that
 * tier's maxWorkspaces quota. Returns the oldest owned workspace as the upgrade target.
 */
export function findBlockingWorkspaceForCreate(args: {
  workspaceIds: string[];
  tier: string;
}): string | null {
  const count = args.workspaceIds.length;
  if (count === 0) return null;

  const tierName = TIER_NAME_MAP[args.tier] ?? 'personal';
  const maxWorkspaces = SUBSCRIPTION_TIERS[tierName].maxWorkspaces;

  if (maxWorkspaces === 'unlimited') return null;
  if (count < (maxWorkspaces)) return null;

  return args.workspaceIds[0] ?? null;
}

async function resolveBlockingWorkspaceForCreate(userId: string): Promise<string | null> {
  if (!env.SUBSCRIPTIONS_ENABLED) return null;

  const rows = await db('workspaces as w')
    .where('w.owner_id', userId)
    .orderBy('w.created_at', 'asc')
    .select<{ workspaceId: string }[]>(
      'w.id as workspaceId',
    );

  const tier = await getCurrentTierForUser(userId);
  return findBlockingWorkspaceForCreate({
    workspaceIds: rows.map((row) => row.workspaceId),
    tier,
  });
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

  const blockingWorkspaceId = await resolveBlockingWorkspaceForCreate(currentUser!.id);
  if (blockingWorkspaceId) {
    return Response.json(
      {
        error: {
          code: 'workspace-creation-limit-reached',
          message: 'You have reached the workspace limit for your current plan.',
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
