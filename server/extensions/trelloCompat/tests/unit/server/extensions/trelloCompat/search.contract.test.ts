import { describe, expect, it } from 'bun:test';
import { parseSearchModelTypes } from '../../../../../api/search';
import { assertTrelloShape } from '../../../../../helpers/assertTrelloShape';
import {
  createBoardFixture,
  createCardFixture,
  createMemberFixture,
  createOrganizationFixture,
} from '../../../../../helpers/fixtures';
import { serializeBoard } from '../../../../../serializers/board';
import { serializeCard } from '../../../../../serializers/card';
import { serializeMember } from '../../../../../serializers/member';
import { serializeOrganization } from '../../../../../serializers/organization';
import { serializeSearchMembers, serializeSearchResponse } from '../../../../../serializers/search';

describe('trelloCompat search adapter contract', () => {
  it('serializes GET /search payload with all required arrays and normalized entity shapes', () => {
    const board = serializeBoard(createBoardFixture());
    const card = serializeCard(createCardFixture());
    const member = serializeMember(createMemberFixture());
    const organization = serializeOrganization(createOrganizationFixture());

    const payload = serializeSearchResponse({
      boards: [board],
      cards: [card],
      members: [member],
      organizations: [organization],
    });

    expect(Object.keys(payload).sort()).toEqual(['boards', 'cards', 'members', 'organizations']);
    expect(() => { assertTrelloShape('board', payload.boards[0]); }).not.toThrow();
    expect(() => { assertTrelloShape('card', payload.cards[0]); }).not.toThrow();
    expect(() => { assertTrelloShape('member', payload.members[0]); }).not.toThrow();
    expect(payload.organizations[0]).toMatchObject({
      id: organization.id,
      name: organization.name,
      displayName: organization.displayName,
      desc: organization.desc,
      prefs: organization.prefs,
      url: organization.url,
    });
  });

  it('always returns all four GET /search arrays even when no model types are selected', () => {
    expect(serializeSearchResponse()).toEqual({
      boards: [],
      cards: [],
      members: [],
      organizations: [],
    });
  });

  it('accepts singular and plural modelType/modelTypes values for search filtering', () => {
    const singular = parseSearchModelTypes(new URLSearchParams('modelType=board,member,organization,card'));
    const plural = parseSearchModelTypes(new URLSearchParams('modelType=boards,members,organizations,cards'));
    const mixed = parseSearchModelTypes(new URLSearchParams('modelType=board&modelTypes=cards,members'));

    expect(singular).toEqual(new Set(['boards', 'members', 'organizations', 'cards']));
    expect(plural).toEqual(new Set(['boards', 'members', 'organizations', 'cards']));
    expect(mixed).toEqual(new Set(['boards', 'cards', 'members']));
  });

  it('falls back to all model types for empty or invalid modelType tokens', () => {
    const empty = parseSearchModelTypes(new URLSearchParams());
    const invalid = parseSearchModelTypes(new URLSearchParams('modelType=foo,bar'));

    expect(empty).toEqual(new Set(['boards', 'cards', 'members', 'organizations']));
    expect(invalid).toEqual(new Set(['boards', 'cards', 'members', 'organizations']));
  });

  it('serializes GET /search/members as normalized member objects', () => {
    const members = serializeSearchMembers([
      serializeMember(createMemberFixture({ id: 'member-2', email: 'search-user@example.com', name: 'Search User' })),
    ]);

    expect(members).toHaveLength(1);
    expect(() => { assertTrelloShape('member', members[0]); }).not.toThrow();
    expect(members[0]).toMatchObject({
      id: 'member-2',
      fullName: 'Search User',
      username: 'searchuser',
      status: 'disconnected',
    });
  });
});
