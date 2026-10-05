import { describe, expect, it } from 'bun:test';
import { projectActionField } from '../../api/actions';
import { assertTrelloShape } from '../../helpers/assertTrelloShape';
import {
  createActivityActionFixture,
  createCommentActionFixture,
  createCommentActionFixtureWithoutList,
  createOrganizationFixture,
  createReactionFixture,
} from '../../helpers/fixtures';
import { serializeActivityAction, serializeCommentAction } from '../../serializers/action';
import { serializeOrganization } from '../../serializers/organization';
import { serializeReaction, serializeReactionsSummary } from '../../serializers/reaction';

describe('trelloCompat actions adapter contract', () => {
  it('serializes comment and activity actions with required Trello keys', () => {
    const comment = serializeCommentAction(createCommentActionFixture());
    const activity = serializeActivityAction(createActivityActionFixture());

    expect(() => {
      assertTrelloShape('action-comment', comment);
    }).not.toThrow();
    expect(() => {
      assertTrelloShape('action-activity', activity);
    }).not.toThrow();
  });

  it('keeps PUT-style updated comment response in Trello action shape', () => {
    const updated = serializeCommentAction(createCommentActionFixture({ content: 'Updated' }));
    expect(() => {
      assertTrelloShape('action-comment', updated);
    }).not.toThrow();
    expect(updated.data.text).toBe('Updated');
  });

  it('supports and rejects action field projections consistently', () => {
    const action = serializeCommentAction(createCommentActionFixture());
    expect(projectActionField(action, 'type')).toEqual({ found: true, value: 'commentCard' });
    expect(projectActionField(action, 'id')).toEqual({ found: true, value: action.id });
    expect(projectActionField(action, 'unknown')).toEqual({ found: false });
  });

  it('omits list block when optional list context is unavailable', () => {
    const payload = serializeCommentAction(createCommentActionFixtureWithoutList());
    expect(payload.data).not.toHaveProperty('list');
  });

  it('serializes organization payload for GET /actions/{id}/organization shape', () => {
    const organization = serializeOrganization(createOrganizationFixture());
    expect(organization).toMatchObject({
      id: 'workspace-1',
      displayName: 'Workspace One',
      desc: 'Workspace description',
      url: '/trello/1/organizations/workspace-1',
    });
    expect(organization.prefs.permissionLevel).toBe('private');
  });

  it('serializes reactions with Trello-compatible keys', () => {
    const reaction = serializeReaction(createReactionFixture());
    expect(reaction).toEqual({
      id: 'reaction-1',
      idMember: 'member-1',
      idModel: 'action-comment-1',
      emoji: ':thumbsup:',
    });
  });

  it('summarizes reactions by emoji for /reactionsSummary response', () => {
    const first = serializeReaction(
      createReactionFixture({ id: 'reaction-1', emoji: ':thumbsup:' })
    );
    const second = serializeReaction(
      createReactionFixture({ id: 'reaction-2', idMember: 'member-2', emoji: ':thumbsup:' })
    );
    const third = serializeReaction(
      createReactionFixture({ id: 'reaction-3', idMember: 'member-3', emoji: ':heart:' })
    );

    const summary = serializeReactionsSummary({
      idModel: 'action-comment-1',
      reactions: [first, second, third],
    });

    expect(summary).toEqual({
      ':thumbsup:': {
        emoji: ':thumbsup:',
        idModel: 'action-comment-1',
        count: 2,
        idMembers: ['member-1', 'member-2'],
      },
      ':heart:': {
        emoji: ':heart:',
        idModel: 'action-comment-1',
        count: 1,
        idMembers: ['member-3'],
      },
    });
  });
});
