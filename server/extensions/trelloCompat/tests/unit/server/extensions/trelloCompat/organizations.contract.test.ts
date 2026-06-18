import { describe, expect, it } from 'bun:test';
import { createOrganizationFixture } from '../../../../../helpers/fixtures';
import { serializeOrganization } from '../../../../../serializers/organization';

describe('trelloCompat organizations adapter contract', () => {
  it('serializes organization payload for GET /organizations/{id} with required Trello keys', () => {
    const organization = serializeOrganization(
      createOrganizationFixture({
        id: 'workspace-1',
        name: 'Workspace One',
        owner_id: 'member-owner',
        desc: 'Workspace description',
        memberships: [
          { user_id: 'member-owner', role: 'OWNER' },
          { user_id: 'member-admin', role: 'ADMIN' },
          { user_id: 'member-viewer', role: 'VIEWER' },
        ],
      })
    );

    expect(organization).toMatchObject({
      id: 'workspace-1',
      name: 'workspaceone',
      displayName: 'Workspace One',
      desc: 'Workspace description',
      idMemberCreator: 'member-owner',
      nodeId: 'workspace-1',
      billableMemberCount: 3,
      powerUps: [],
      products: [],
      url: '/trello/1/organizations/workspace-1',
      website: null,
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
    });

    expect(organization.memberships).toEqual([
      {
        id: 'workspace-1-member-owner',
        idMember: 'member-owner',
        memberType: 'admin',
        unconfirmed: false,
        deactivated: false,
      },
      {
        id: 'workspace-1-member-admin',
        idMember: 'member-admin',
        memberType: 'admin',
        unconfirmed: false,
        deactivated: false,
      },
      {
        id: 'workspace-1-member-viewer',
        idMember: 'member-viewer',
        memberType: 'observer',
        unconfirmed: false,
        deactivated: false,
      },
    ]);

    expect(Object.keys(organization).sort()).toEqual([
      'billableMemberCount',
      'desc',
      'descData',
      'displayName',
      'id',
      'idEnterprise',
      'idMemberCreator',
      'memberships',
      'name',
      'nodeId',
      'powerUps',
      'prefs',
      'products',
      'url',
      'website',
    ]);
    expect(Object.keys(organization.prefs).sort()).toEqual([
      'calendarFeedEnabled',
      'cardAging',
      'cardCovers',
      'comments',
      'invitations',
      'isTemplate',
      'permissionLevel',
      'selfJoin',
      'voting',
    ]);
  });

  it('maps visibility and optional website to Trello-compatible organization fields', () => {
    const publicOrg = serializeOrganization(
      createOrganizationFixture({
        visibility: 'PUBLIC',
        website: 'https://example.com',
      })
    );
    const privateOrg = serializeOrganization(
      createOrganizationFixture({
        visibility: 'WORKSPACE',
        website: null,
      })
    );

    expect(publicOrg.prefs.permissionLevel).toBe('public');
    expect(publicOrg.website).toBe('https://example.com');

    expect(privateOrg.prefs.permissionLevel).toBe('private');
    expect(privateOrg.website).toBeNull();
  });

  it('normalizes blank website values to null', () => {
    const organization = serializeOrganization(
      createOrganizationFixture({
        website: '   ',
      })
    );

    expect(organization.website).toBeNull();
  });

  it('applies Trello-safe defaults for missing optional organization fields', () => {
    const organization = serializeOrganization({
      id: 'workspace-2',
      name: 'Another Workspace',
      owner_id: null,
      desc: null,
      memberships: [],
    });

    expect(organization).toMatchObject({
      id: 'workspace-2',
      name: 'anotherworkspace',
      displayName: 'Another Workspace',
      desc: '',
      idMemberCreator: null,
      billableMemberCount: 0,
      memberships: [],
      website: null,
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
    });
  });

  it('derives billableMemberCount from memberships array length', () => {
    const organization = serializeOrganization(
      createOrganizationFixture({
        memberships: [
          { user_id: 'member-owner', role: 'OWNER' },
          { user_id: 'member-guest', role: 'GUEST' },
          { user_id: 'member-viewer', role: 'VIEWER' },
          { user_id: 'member-normal', role: 'MEMBER' },
        ],
      })
    );

    expect(organization.memberships).toHaveLength(4);
    expect(organization.billableMemberCount).toBe(4);
  });
});
