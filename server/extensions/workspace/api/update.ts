// PATCH /api/v1/workspaces/:id — update workspace settings; min role: ADMIN.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { isValidHttpsOrigin } from '../../plugins/common/isValidHttpsOrigin';

const MAX_PLUGIN_DOMAINS = 20;

interface UpdateBody {
  name?: string;
  pluginDomains?: string[] | null;
}

interface WorkspaceRow {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  plugin_domains?: unknown;
}

function formatWorkspaceResponse(row: WorkspaceRow) {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    pluginDomains: row.plugin_domains,
  };
}

/** Validates and normalises the pluginDomains field. Returns an error response or null. */
function validatePluginDomains(input: string[] | null): Response | string | null {
  if (input === null) return 'null'; // signal to set null in DB

  if (!Array.isArray(input)) {
    return Response.json(
      { error: { code: 'bad-request', message: 'pluginDomains must be an array or null' } },
      { status: 400 }
    );
  }

  if (input.length > MAX_PLUGIN_DOMAINS) {
    return Response.json(
      {
        error: {
          code: 'bad-request',
          message: `pluginDomains cannot exceed ${String(MAX_PLUGIN_DOMAINS)} entries`,
        },
      },
      { status: 400 }
    );
  }

  for (const domain of input) {
    if (typeof domain !== 'string' || !isValidHttpsOrigin(domain)) {
      return Response.json(
        { error: { code: 'bad-request', message: `'${domain}' is not a valid HTTPS origin` } },
        { status: 400 }
      );
    }
  }

  return JSON.stringify(input); // serialised for jsonb column
}

export async function handleUpdateWorkspace(req: Request, workspaceId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, workspaceId);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      return Response.json(
        { error: { code: 'bad-request', message: 'name must be a non-empty string' } },
        { status: 400 }
      );
    }
    updates.name = body.name.trim();
  }

  // [why] Workspace admins whitelist domains for plugins enabled in their
  // workspace. These domains are included in the CSP frame-ancestors directive
  // so plugin iframes can embed board pages.
  if (body.pluginDomains !== undefined) {
    const result = validatePluginDomains(body.pluginDomains);
    if (result instanceof Response) return result;
    updates.plugin_domains = result; // null sentinel or JSON string
  }

  if (Object.keys(updates).length === 0) {
    return Response.json(
      { error: { code: 'bad-request', message: 'No valid fields to update' } },
      { status: 400 }
    );
  }

  const updated = await db('workspaces').where({ id: workspaceId }).update(updates, ['*']);

  if (!updated.length) {
    return Response.json(
      { error: { code: 'workspace-not-found', message: 'Workspace not found' } },
      { status: 404 }
    );
  }

  return Response.json({ data: formatWorkspaceResponse(updated[0] as WorkspaceRow) });
}
