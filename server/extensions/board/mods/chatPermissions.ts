// server/extensions/board/mods/chatPermissions.ts
// Sprint 165 — helpers for board chat permission defaults, normalization, and enforcement.
import type { BoardChatPermissions, PatchBoardChatPermissionsBody } from '../types';

export const CHAT_PERMISSION_DEFAULTS: Omit<BoardChatPermissions, 'board_id' | 'updated_at'> = {
  guest_can_view: false,
  guest_can_use: false,
};

// Applies toggle coupling rules:
//   - guest_can_use=true  → forces guest_can_view=true
//   - guest_can_view=false → forces guest_can_use=false (takes precedence)
//
// Priority: an explicit guest_can_view=false in the patch always wins over
// a guest_can_use=true inherited from the current state.
export function normalizeChatPermissions(
  current: Pick<BoardChatPermissions, 'guest_can_view' | 'guest_can_use'>,
  patch: PatchBoardChatPermissionsBody,
): Pick<BoardChatPermissions, 'guest_can_view' | 'guest_can_use'> {
  let guest_can_view = patch.guest_can_view ?? current.guest_can_view;
  let guest_can_use = patch.guest_can_use ?? current.guest_can_use;

  // use=true implies view must also be true.
  if (guest_can_use) {
    guest_can_view = true;
  }

  // An explicit view=false in the patch overrides the use→view implication,
  // and forces use off as well.
  if (patch.guest_can_view === false) {
    guest_can_view = false;
    guest_can_use = false;
  }

  return { guest_can_view, guest_can_use };
}

export function resolveGuestChatPermissions(
  row: Partial<Pick<BoardChatPermissions, 'guest_can_view' | 'guest_can_use'>> | null | undefined,
): Pick<BoardChatPermissions, 'guest_can_view' | 'guest_can_use'> {
  const guest_can_view = row?.guest_can_view ?? CHAT_PERMISSION_DEFAULTS.guest_can_view;
  const guest_can_use = row?.guest_can_use ?? CHAT_PERMISSION_DEFAULTS.guest_can_use;

  return normalizeChatPermissions(
    { ...CHAT_PERMISSION_DEFAULTS },
    { guest_can_view, guest_can_use },
  );
}

export function canGuestViewBoardChat(
  row: Partial<Pick<BoardChatPermissions, 'guest_can_view' | 'guest_can_use'>> | null | undefined,
): boolean {
  const effective = resolveGuestChatPermissions(row);
  return effective.guest_can_view;
}

export function canGuestUseBoardChat(
  row: Partial<Pick<BoardChatPermissions, 'guest_can_view' | 'guest_can_use'>> | null | undefined,
): boolean {
  const effective = resolveGuestChatPermissions(row);
  return effective.guest_can_use;
}
