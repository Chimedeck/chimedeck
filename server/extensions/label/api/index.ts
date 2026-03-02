// Label API router — workspace-scoped label management.
import { handleCreateLabel } from './create';
import { handleListLabels } from './list';
import { handleUpdateLabel } from './update';
import { handleDeleteLabel } from './delete';

export async function labelRouter(req: Request, pathname: string): Promise<Response | null> {
  // Workspace-scoped: /api/v1/workspaces/:id/labels
  const workspaceLabelMatch = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/labels$/);
  if (workspaceLabelMatch) {
    const workspaceId = workspaceLabelMatch[1] as string;
    if (req.method === 'POST') return handleCreateLabel(req, workspaceId);
    if (req.method === 'GET') return handleListLabels(req, workspaceId);
  }

  // Label-scoped: /api/v1/labels/:id
  const labelMatch = pathname.match(/^\/api\/v1\/labels\/([^/]+)$/);
  if (labelMatch) {
    const labelId = labelMatch[1] as string;
    if (req.method === 'PATCH') return handleUpdateLabel(req, labelId);
    if (req.method === 'DELETE') return handleDeleteLabel(req, labelId);
  }

  return null;
}
