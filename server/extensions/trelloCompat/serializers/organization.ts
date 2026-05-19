import type { TrelloOrganization, TrelloOrgMembership } from '../types/trello';
import { workspaceRoleToMemberType } from './member';

function toOrgSlug(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

export function serializeOrganization(workspace: {
  id: string;
  name: string;
  owner_id?: string | null;
  desc?: string | null;
  website?: string | null;
  memberships?: Array<{ user_id: string; role: string }>;
}): TrelloOrganization {
  const memberships: TrelloOrgMembership[] = (workspace.memberships ?? []).map((membership) => {
    const memberType = workspaceRoleToMemberType(membership.role);
    return {
      id: `${workspace.id}-${membership.user_id}`,
      idMember: membership.user_id,
      memberType: memberType === 'ghost' ? 'normal' : memberType,
      unconfirmed: false,
      deactivated: false,
    };
  });

  return {
    id: workspace.id,
    billableMemberCount: memberships.length,
    desc: workspace.desc ?? '',
    descData: null,
    displayName: workspace.name,
    idEnterprise: null,
    idMemberCreator: workspace.owner_id ?? null,
    memberships,
    name: toOrgSlug(workspace.name),
    nodeId: workspace.id,
    powerUps: [],
    prefs: {
      permissionLevel: 'private',
      voting: 'disabled',
      comments: 'members',
      invitations: 'admins',
      selfJoin: false,
      cardCovers: true,
      isTemplate: false,
      cardAging: 'regular',
      calendarFeedEnabled: false,
    },
    products: [],
    url: `/trello/1/organizations/${workspace.id}`,
    website: null,
  };
}
