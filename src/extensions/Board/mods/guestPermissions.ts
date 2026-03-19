// src/extensions/Board/mods/guestPermissions.ts
// Sprint 89 — client-side guest permission helpers, mirroring server logic.
// Used by UI components to conditionally render write-action controls.

export type GuestType = 'VIEWER' | 'MEMBER';

// Returns true when a GUEST with the given type is allowed to perform write operations.
// null/undefined guestType (non-guest user) always returns true so regular members
// are never accidentally blocked by this check.
export const canBoardGuestWrite = (guestType: GuestType | null | undefined): boolean => {
  if (guestType == null) return true;
  return guestType === 'MEMBER';
};
