// workspaceSlice — selectors for the current user's workspace role.
// The role is embedded in each Workspace record as `callerRole` returned by
// GET /api/v1/workspaces. No extra API call is needed.
import { createSelector } from '@reduxjs/toolkit';
import { selectActiveWorkspace } from '../duck/workspaceDuck';
import type { Role } from '../api';

// selectCurrentUserWorkspaceRole returns the authenticated caller's role in the
// active workspace, or null when no workspace is active / data not yet loaded.
export const selectCurrentUserWorkspaceRole = createSelector(
  selectActiveWorkspace,
  (workspace): Role | null => workspace?.callerRole ?? null,
);

// Convenience predicate — true only for GUEST-role callers.
export const selectIsGuestInActiveWorkspace = createSelector(
  selectCurrentUserWorkspaceRole,
  (role): boolean => role === 'GUEST',
);
