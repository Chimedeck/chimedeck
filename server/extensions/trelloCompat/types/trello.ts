export type TrelloMemberType = 'admin' | 'normal' | 'observer' | 'ghost';

export interface TrelloMember {
  id: string;
  activityBlocked: boolean;
  avatarHash: string | null;
  avatarUrl: string | null;
  bio: string;
  confirmed: true;
  fullName: string;
  idEnterprise: null;
  idMemberReferrer: null;
  initials: string;
  memberType: TrelloMemberType;
  nonPublic: Record<string, never>;
  nonPublicAvailable: false;
  products: never[];
  url: string;
  username: string;
  status: 'disconnected';
}

export interface TrelloLabel {
  id: string;
  idBoard: string;
  name: string;
  color: string | null;
}

export interface TrelloCheckItem {
  id: string;
  idChecklist: string;
  idCard: string;
  name: string;
  pos: number;
  state: 'complete' | 'incomplete';
  due: string | null;
  dueReminder: number | null;
  idMember: string | null;
}

export interface TrelloChecklist {
  id: string;
  idBoard: string;
  idCard: string;
  name: string;
  pos: number;
  checkItems: TrelloCheckItem[];
}

export interface TrelloCard {
  id: string;
  address: null;
  badges: TrelloBadge;
  checkItemStates: TrelloCheckItem[] | null;
  closed: boolean;
  coordinates: null;
  cover: {
    idAttachment: string | null;
    color: string | null;
    idUploadedBackground: null;
    size: 'normal' | 'full';
    brightness: 'dark' | 'light';
    isTemplate: boolean;
  };
  creationMethod: null;
  dateLastActivity: string;
  desc: string;
  descData: null;
  due: string | null;
  dueComplete: boolean;
  dueReminder: number | null;
  idAttachmentCover: string | null;
  idBoard: string;
  idChecklists: string[];
  idLabels: string[];
  idList: string;
  idMembers: string[];
  idMembersVoted: never[];
  idShort: number;
  labels: TrelloLabel[];
  limits: Record<string, never>;
  locationName: null;
  manualCoverAttachment: boolean;
  name: string;
  nodeId: string;
  pos: number;
  shortLink: string;
  shortUrl: string;
  start: string | null;
  subscribed: false;
  url: string;
  customFieldItems?: TrelloCustomFieldItem[];
}

export interface TrelloBadge {
  attachmentsByType: { trello: { board: 0; card: 0 } };
  location: false;
  votes: 0;
  viewingMemberVoted: false;
  subscribed: false;
  dueComplete: boolean;
  due: string | null;
  start: string | null;
  description: boolean;
  attachments: number;
  comments: number;
  checkItems: number;
  checkItemsChecked: number;
  checkItemsEarliestDue: null;
  fogbugz: string;
}

export interface TrelloList {
  id: string;
  closed: boolean;
  color: string | null;
  idBoard: string;
  name: string;
  nodeId: string;
  pos: number;
  softLimit: null;
  status: null;
  subscribed: false;
}

export interface TrelloBoardMembership {
  id: string;
  idMember: string;
  memberType: Exclude<TrelloMemberType, 'ghost'>;
  unconfirmed: false;
  deactivated: false;
}

export interface TrelloBoard {
  id: string;
  closed: boolean;
  creationMethod: null;
  dateLastActivity: string | null;
  dateLastView: null;
  datePluginDisable: null;
  desc: string;
  descData: null;
  enterpriseOwned: false;
  idEnterprise: null;
  idMemberCreator: string;
  idOrganization: string;
  idTags: never[];
  invitations: never[];
  invited: false;
  labelNames: {
    green: string; yellow: string; orange: string; red: string;
    purple: string; blue: string; sky: string; lime: string;
    pink: string; black: string;
  };
  limits: Record<string, never>;
  memberships: TrelloBoardMembership[];
  name: string;
  nodeId: string;
  pinned: null;
  powerUps: never[];
  prefs: {
    permissionLevel: 'private' | 'org' | 'public';
    hideVotes: false;
    voting: 'disabled';
    comments: 'members';
    invitations: 'members';
    selfJoin: false;
    cardCovers: true;
    isTemplate: false;
    cardAging: 'regular';
    calendarFeedEnabled: false;
    background: string;
    backgroundColor: string | null;
    backgroundImage: string | null;
    backgroundTile: false;
    backgroundBrightness: 'unknown';
    backgroundImageScaled: null;
    canBePublic: true;
    canBeEnterprise: false;
    canBeOrg: true;
    canBePrivate: true;
    canInvite: true;
  };
  shortLink: string;
  shortUrl: string;
  starred: false;
  subscribed: false;
  templateGallery: null;
  url: string;
}

export interface TrelloOrgMembership {
  id: string;
  idMember: string;
  memberType: Exclude<TrelloMemberType, 'ghost'>;
  unconfirmed: false;
  deactivated: false;
}

export interface TrelloOrganization {
  id: string;
  billableMemberCount: number;
  desc: string;
  descData: null;
  displayName: string;
  idEnterprise: null;
  idMemberCreator: string | null;
  memberships: TrelloOrgMembership[];
  name: string;
  nodeId: string;
  powerUps: never[];
  prefs: {
    permissionLevel: 'private' | 'public';
    voting: 'disabled';
    comments: 'members';
    invitations: 'admins';
    selfJoin: false;
    cardCovers: true;
    isTemplate: false;
    cardAging: 'regular';
    calendarFeedEnabled: false;
  };
  products: never[];
  url: string;
  website: null;
}

export interface TrelloAction {
  id: string;
  idMemberCreator: string;
  data: Record<string, unknown>;
  appCreator: null;
  type: TrelloActionType | string;
  date: string;
  limits: Record<string, never>;
  memberCreator: TrelloMember;
}

export type TrelloActionType =
  | 'commentCard'
  | 'createCard'
  | 'updateCard'
  | 'addMemberToCard'
  | 'removeMemberFromCard'
  | 'createList'
  | 'addLabelToCard'
  | 'removeLabelFromCard';

export interface TrelloCustomField {
  id: string;
  idModel: string;
  modelType: 'board';
  fieldGroup: string;
  display: { cardFront: boolean };
  name: string;
  pos: number;
  type: TrelloCustomFieldType;
  options: TrelloCustomFieldOption[];
}

export type TrelloCustomFieldType = 'text' | 'number' | 'date' | 'checkbox' | 'list';

export interface TrelloCustomFieldOption {
  id: string;
  idCustomField: string;
  value: { text: string };
  color: string | null;
  pos: number;
}

export interface TrelloCustomFieldItem {
  id: string;
  idCustomField: string;
  idModel: string;
  modelType: 'card';
  idValue?: string;
  value: {
    text?: string | null;
    number?: string | null;
    date?: string | null;
    checked?: string | null;
    optionId?: string | null;
  };
}

export interface TrelloSearchResponse {
  boards: TrelloBoard[];
  cards: TrelloCard[];
  members: TrelloMember[];
  organizations: TrelloOrganization[];
}
