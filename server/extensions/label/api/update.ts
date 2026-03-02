// PATCH /api/v1/labels/:id — update label name/color; min role: ADMIN.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleUpdateLabel(req: Request, labelId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const label = await db('labels').where({ id: labelId }).first();
  if (!label) {
    return Response.json(
      { name: 'label-not-found', data: { message: 'Label not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, label.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  let body: { name?: string; color?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const updates: { name?: string; color?: string } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      return Response.json(
        { name: 'bad-request', data: { message: 'name must be a non-empty string' } },
        { status: 400 },
      );
    }
    updates.name = body.name.trim();
  }

  if (body.color !== undefined) {
    if (typeof body.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
      return Response.json(
        { name: 'bad-request', data: { message: 'color must be a hex color (e.g. #FF5733)' } },
        { status: 400 },
      );
    }
    updates.color = body.color;
  }

  if (Object.keys(updates).length > 0) {
    await db('labels').where({ id: labelId }).update(updates);
  }

  const updated = await db('labels').where({ id: labelId }).first();
  return Response.json({ data: updated });
}
