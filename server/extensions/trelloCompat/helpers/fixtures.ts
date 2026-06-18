type BasicMember = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
};

type CommentActionFixture = {
  id: string;
  card_id: string;
  board_id: string;
  list_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  memberCreator: BasicMember;
  cardName: string;
  boardName: string;
  listName: string;
};

type ActivityActionFixture = {
  id: string;
  type: string;
  card_id: string;
  board_id: string;
  user_id: string;
  payload: Record<string, unknown>;
  created_at: string;
  memberCreator: BasicMember;
};

type BoardFixture = {
  id: string;
  title: string;
  description: string;
  state: 'ACTIVE' | 'ARCHIVED';
  workspace_id: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'WORKSPACE';
  background: string;
  created_at: string;
  idMemberCreator: string;
  memberships: Array<{
    id: string;
    idMember: string;
    memberType: 'admin' | 'normal' | 'observer';
    unconfirmed: false;
    deactivated: false;
  }>;
};

type CardFixture = {
  id: string;
  list_id: string;
  board_id: string;
  title: string;
  description: string;
  archived: boolean;
  due_date: string | null;
  due_complete: boolean;
  start_date: string | null;
  _rank: number;
  updated_at: string;
  created_at: string;
  short_id: number;
  labels: Array<{ id: string }>;
  members: Array<{ user_id: string }>;
  checklists: Array<{ id: string }>;
};

type ListFixture = {
  id: string;
  board_id: string;
  title: string;
  archived: boolean;
  color: string | null;
  _rank: number;
};

type CheckItemFixture = {
  id: string;
  checklist_id: string;
  card_id: string;
  title: string;
  checked: boolean;
  _rank: number;
  due_date: string | null;
  assigned_user_id: string | null;
  assigned_member_id: string | null;
};

type ChecklistFixture = {
  id: string;
  board_id: string;
  card_id: string;
  title: string;
  _rank: number;
  checkItems: CheckItemFixture[];
};

type MemberFixture = BasicMember;
type ReactionFixture = {
  id: string;
  idMember: string;
  idModel: string;
  emoji: string;
};
type OrganizationFixture = {
  id: string;
  name: string;
  owner_id: string;
  desc: string;
  website: string | null;
  visibility?: 'PUBLIC' | 'PRIVATE' | 'WORKSPACE';
  memberships: Array<{ user_id: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST' }>;
};

const FIXTURE_DATE = '2026-01-02T03:04:05.000Z';

export function createMemberFixture(overrides: Partial<MemberFixture> = {}): MemberFixture {
  return {
    id: 'member-1',
    email: 'member-1@example.com',
    name: 'Member One',
    avatar_url: null,
    ...overrides,
  };
}

export function createCommentActionFixture(
  overrides: Partial<CommentActionFixture> = {}
): CommentActionFixture {
  const memberCreator = createMemberFixture(overrides.memberCreator);
  return {
    id: 'action-comment-1',
    card_id: 'card-1',
    board_id: 'board-1',
    list_id: 'list-1',
    user_id: memberCreator.id,
    content: 'Fixture comment',
    created_at: FIXTURE_DATE,
    memberCreator,
    cardName: 'Card One',
    boardName: 'Board One',
    listName: 'List One',
    ...overrides,
  };
}

export function createCommentActionFixtureWithoutList(
  overrides: Partial<CommentActionFixture> = {}
): CommentActionFixture {
  return createCommentActionFixture({
    list_id: null,
    listName: '',
    ...overrides,
  });
}

export function createActivityActionFixture(
  overrides: Partial<ActivityActionFixture> = {}
): ActivityActionFixture {
  const memberCreator = createMemberFixture(overrides.memberCreator);
  return {
    id: 'action-activity-1',
    type: 'card_updated',
    card_id: 'card-1',
    board_id: 'board-1',
    user_id: memberCreator.id,
    payload: {
      old: { name: 'Old Card Name' },
      card: { id: 'card-1', name: 'Card One' },
    },
    created_at: FIXTURE_DATE,
    memberCreator,
    ...overrides,
  };
}

export function createBoardFixture(overrides: Partial<BoardFixture> = {}): BoardFixture {
  return {
    id: 'board-1',
    title: 'Board One',
    description: 'Board description',
    state: 'ACTIVE',
    workspace_id: 'workspace-1',
    visibility: 'WORKSPACE',
    background: 'blue',
    created_at: FIXTURE_DATE,
    idMemberCreator: 'member-1',
    memberships: [
      {
        id: 'membership-1',
        idMember: 'member-1',
        memberType: 'admin',
        unconfirmed: false,
        deactivated: false,
      },
    ],
    ...overrides,
  };
}

export function createCardFixture(overrides: Partial<CardFixture> = {}): CardFixture {
  return {
    id: 'card-1',
    list_id: 'list-1',
    board_id: 'board-1',
    title: 'Card One',
    description: 'Card description',
    archived: false,
    due_date: null,
    due_complete: false,
    start_date: null,
    _rank: 0,
    updated_at: FIXTURE_DATE,
    created_at: FIXTURE_DATE,
    short_id: 1,
    labels: [{ id: 'label-1' }],
    members: [{ user_id: 'member-1' }],
    checklists: [{ id: 'checklist-1' }],
    ...overrides,
  };
}

export function createListFixture(overrides: Partial<ListFixture> = {}): ListFixture {
  return {
    id: 'list-1',
    board_id: 'board-1',
    title: 'List One',
    archived: false,
    color: null,
    _rank: 0,
    ...overrides,
  };
}

export function createCheckItemFixture(
  overrides: Partial<CheckItemFixture> = {}
): CheckItemFixture {
  return {
    id: 'checkitem-1',
    checklist_id: 'checklist-1',
    card_id: 'card-1',
    title: 'Checklist item one',
    checked: false,
    _rank: 0,
    due_date: null,
    assigned_user_id: null,
    assigned_member_id: null,
    ...overrides,
  };
}

export function createChecklistFixture(
  overrides: Partial<ChecklistFixture> = {}
): ChecklistFixture {
  return {
    id: 'checklist-1',
    board_id: 'board-1',
    card_id: 'card-1',
    title: 'Checklist One',
    _rank: 0,
    checkItems: [createCheckItemFixture()],
    ...overrides,
  };
}

export function createReactionFixture(overrides: Partial<ReactionFixture> = {}): ReactionFixture {
  return {
    id: 'reaction-1',
    idMember: 'member-1',
    idModel: 'action-comment-1',
    emoji: ':thumbsup:',
    ...overrides,
  };
}

export function createOrganizationFixture(
  overrides: Partial<OrganizationFixture> = {}
): OrganizationFixture {
  return {
    id: 'workspace-1',
    name: 'Workspace One',
    owner_id: 'member-1',
    desc: 'Workspace description',
    website: null,
    memberships: [
      { user_id: 'member-1', role: 'OWNER' },
      { user_id: 'member-2', role: 'MEMBER' },
    ],
    ...overrides,
  };
}
