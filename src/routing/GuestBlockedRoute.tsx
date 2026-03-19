import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectIsGuestInActiveWorkspace } from '~/extensions/Workspace/slices/workspaceSlice';
import { selectActiveWorkspaceId } from '~/extensions/Workspace/duck/workspaceDuck';

// Guards routes that GUEST users must not access (e.g. workspace members page).
// [why] Deny-first: if the current user holds the GUEST role in the active workspace,
// redirect them to the workspace boards page so they land in a valid view.
// While workspace data is still loading (role is null), render nothing to avoid a
// premature redirect that would misdirect legitimately-permissioned users.
export default function GuestBlockedRoute() {
  const isGuest = useAppSelector(selectIsGuestInActiveWorkspace);
  const activeWorkspaceId = useAppSelector(selectActiveWorkspaceId);
  const { workspaceId } = useParams<{ workspaceId: string }>();

  // Resolve the workspace ID: prefer URL param, fall back to active workspace.
  const resolvedWorkspaceId = workspaceId ?? activeWorkspaceId;

  if (isGuest) {
    const target = resolvedWorkspaceId
      ? `/workspaces/${resolvedWorkspaceId}/boards`
      : '/workspaces';
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
