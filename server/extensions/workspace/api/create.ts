// POST /api/v1/workspaces — create a new workspace; caller becomes OWNER.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { env } from '../../../config/env';
import { SUBSCRIPTION_TIERS } from '../../../config/subscription-tiers';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import type { SubscriptionTier } from '../../subscription/common/types';

type OwnedWorkspaceTierRow = {
  workspaceId: string;
  tier: SubscriptionTier | null;
};

// Numeric rank for comparing tier capability (higher = more permissive)
const TIER_RANK: Record<string, number> = {
  tier_1: 0,
  tier_2: 1,
  tier_3: 2,
  tier_4: 3,
  unlimited: 4,
};

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
 * Logic: find the user's best (highest) tier across all owned workspaces; if the owned
 * workspace count is already at or above that tier's maxWorkspaces limit, block and return
 * the lowest-tier workspace as the upgrade target.
 */
export function findBlockingWorkspaceForCreate(rows: OwnedWorkspaceTierRow[]): string | null {
  const count = rows.length;
  if (count === 0) return null;

  // Find the workspace with the highest tier (best entitlements)
  const bestRow = rows.reduce((best, row) => {
    const rank = TIER_RANK[row.tier ?? 'tier_1'] ?? 0;
    const bestRank = TIER_RANK[best.tier ?? 'tier_1'] ?? 0;
    return rank > bestRank ? row : best;
  });

  const bestTier = bestRow.tier ?? 'tier_1';
  const tierName = TIER_NAME_MAP[bestTier] ?? 'personal';
  const maxWorkspaces = SUBSCRIPTION_TIERS[tierName].maxWorkspaces;

  if (maxWorkspaces === 'unlimited') return null;
  if (count < (maxWorkspaces as number)) return null;

  // Return the lowest-tier workspace as the upgrade target
  const lowestRank = Math.min(...rows.map((r) => TIER_RANK[r.tier ?? 'tier_1'] ?? 0));
  const lowestRow = rows.find((r) => (TIER_RANK[r.tier ?? 'tier_1'] ?? 0) === lowestRank) ?? rows[0];
  return lowestRow.workspaceId;
}

async function resolveBlockingWorkspaceForCreate(userId: string): Promise<string | null> {
  if (!env.SUBSCRIPTIONS_ENABLED) return null;

  const rows = await db('workspaces as w')
    .leftJoin('workspace_subscriptions as ws', 'w.id', 'ws.workspace_id')
    .where('w.owner_id', userId)
    .select<{ workspaceId: string; tier: SubscriptionTier | null }[]>(
      'w.id as workspaceId',
      'ws.tier as tier',
    );

  return findBlockingWorkspaceForCreate(rows);
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
