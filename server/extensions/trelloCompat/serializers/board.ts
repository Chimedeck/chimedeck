import type { TrelloBoard, TrelloBoardMembership } from '../types/trello';
import { serializeEmbeddedLabel } from './label';

type VisibilityPermLevel = 'private' | 'org' | 'public';

function visibilityToPermLevel(v: string | null | undefined): VisibilityPermLevel {
  if (v === 'PUBLIC') return 'public';
  if (v === 'WORKSPACE') return 'org';
  return 'private';
}

export function serializeBoardLabels(labels: Array<{
  id: string;
  board_id?: string | null;
  idBoard?: string | null;
  name?: string | null;
  color?: string | null;
}>, boardId: string): Array<{
  id: string;
  idBoard: string;
  name: string;
  color: string | null;
}> {
  return labels.map((label) => serializeEmbeddedLabel(label, boardId));
}

export function serializeBoard(board: {
  id: string;
  short_id?: string | null;
  title: string;
  description?: string | null;
  state: 'ACTIVE' | 'ARCHIVED';
  workspace_id: string;
  visibility?: string | null;
  background?: string | null;
  created_at?: Date | string | null;
  idMemberCreator?: string;
  memberships?: TrelloBoardMembership[];
}): TrelloBoard {
  const closed = board.state === 'ARCHIVED';
  const permissionLevel = visibilityToPermLevel(board.visibility);
  const background = board.background ?? 'blue';
  const shortLink = board.short_id ?? board.id.slice(0, 8);

  return {
    id: board.id,
    closed,
    creationMethod: null,
    dateLastActivity: board.created_at ? new Date(board.created_at).toISOString() : null,
    dateLastView: null,
    datePluginDisable: null,
    desc: board.description ?? '',
    descData: null,
    enterpriseOwned: false,
    idEnterprise: null,
    idMemberCreator: board.idMemberCreator ?? '',
    idOrganization: board.workspace_id,
    idTags: [],
    invitations: [],
    invited: false,
    labelNames: {
      green: '',
      yellow: '',
      orange: '',
      red: '',
      purple: '',
      blue: '',
      sky: '',
      lime: '',
      pink: '',
      black: '',
    },
    limits: {},
    memberships: board.memberships ?? [],
    name: board.title,
    nodeId: board.id,
    pinned: null,
    powerUps: [],
    prefs: {
      permissionLevel,
      hideVotes: false,
      voting: 'disabled',
      comments: 'members',
      invitations: 'members',
      selfJoin: false,
      cardCovers: true,
      isTemplate: false,
      cardAging: 'regular',
      calendarFeedEnabled: false,
      background,
      backgroundColor: null,
      backgroundImage: null,
      backgroundTile: false,
      backgroundBrightness: 'unknown',
      backgroundImageScaled: null,
      canBePublic: true,
      canBeEnterprise: false,
      canBeOrg: true,
      canBePrivate: true,
      canInvite: true,
    },
    shortLink,
    shortUrl: `/trello/1/b/${shortLink}`,
    starred: false,
    subscribed: false,
    templateGallery: null,
    url: `/trello/1/boards/${board.id}`,
  };
}
