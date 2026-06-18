import type { TrelloMember, TrelloMemberType } from '../types/trello';

function toInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 3);
}

export function usernameFromEmail(email: string): string {
  return (email.split('@')[0] ?? email).toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function boardRoleToMemberType(role: unknown): Exclude<TrelloMemberType, 'ghost'> {
  if (role === 'ADMIN') return 'admin';
  if (role === 'VIEWER') return 'observer';
  return 'normal';
}

export function workspaceRoleToMemberType(role: unknown): TrelloMemberType {
  if (role === 'OWNER' || role === 'ADMIN') return 'admin';
  if (role === 'VIEWER') return 'observer';
  if (role === 'GUEST') return 'ghost';
  return 'normal';
}

export function serializeMember(user: {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  memberType?: TrelloMemberType;
}): TrelloMember {
  return {
    id: user.id,
    activityBlocked: false,
    avatarHash: null,
    avatarUrl: user.avatar_url ?? null,
    bio: '',
    confirmed: true,
    fullName: user.name,
    idEnterprise: null,
    idMemberReferrer: null,
    initials: toInitials(user.name),
    memberType: user.memberType ?? 'normal',
    nonPublic: {},
    nonPublicAvailable: false,
    products: [],
    url: `/trello/1/members/${user.id}`,
    username: usernameFromEmail(user.email),
    status: 'disconnected',
  };
}

export function toCardMemberIds(rows: Array<{ user_id: string }>): string[] {
  return rows.map((row) => row.user_id);
}
