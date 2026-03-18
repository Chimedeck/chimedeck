// server/extensions/board/mods/guestPermissions.ts
// Sprint 89 — helpers for enforcing VIEWER vs MEMBER guest permissions.
import type { GuestType } from '../types';

// Returns true if a GUEST with the given type can perform write operations on the board.
export const guestCanWrite = (guestType: GuestType): boolean =>
  guestType === 'MEMBER';

// Returns the correct 403 error name for a denied guest action.
// VIEWER guests receive a specific "insufficient-permissions" error so the
// client can surface a meaningful message.
export const guestDeniedError = (guestType: GuestType): string =>
  guestType === 'VIEWER'
    ? 'guest-viewer-insufficient-permissions'
    : 'guest-role-no-org-access';
