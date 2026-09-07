import { db } from '../../../../common/db';
import { TRELLO_ORGANIZATION_NOT_FOUND } from '../../common/errors';
import { serializeOrganization } from '../../serializers/organization';

type BoardRef = {
  workspace_id: string;
};

type WorkspaceRow = {
  id: string;
  name: string;
  owner_id?: string | null;
  desc?: string | null;
  website?: string | null;
};

type MembershipRow = {
  user_id: string;
  role: string;
};

export async function getActionOrganizationResponse(board: BoardRef): Promise<Response> {
  const workspace = await db('workspaces').where({ id: board.workspace_id }).first() as WorkspaceRow | undefined;
  if (!workspace) return TRELLO_ORGANIZATION_NOT_FOUND();

  const memberships = (await db('memberships')
    .where({ workspace_id: workspace.id })
    .orderBy('user_id', 'asc') as MembershipRow[])
    .filter((membership) => membership.role !== 'GUEST');

  return Response.json(serializeOrganization({
    ...workspace,
    memberships,
  }));
}
