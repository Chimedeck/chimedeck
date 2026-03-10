// guestGuard.ts — blocks GUEST-role callers from executing any board mutation.
// Attach after requireWorkspaceMembership() so req.callerRole is already populated.
// GUESTs are read-only; all write/delete operations must return 403.
import type { WorkspaceScopedRequest } from './permissionManager';

// Returns null (allow) when the caller is NOT a GUEST.
// Returns a 403 Response when the caller holds the GUEST role.
export function guestGuard(req: WorkspaceScopedRequest): Response | null {
  if (req.callerRole === 'GUEST') {
    return Response.json(
      { error: { code: 'guest-role-insufficient-permissions', message: 'Guests have read-only access and cannot perform this action' } },
      { status: 403 },
    );
  }
  return null;
}
