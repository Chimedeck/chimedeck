// Dropdown for switching between the current user's workspaces.
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  workspacesSelector,
  fetchWorkspacesInProgressSelector,
  currentWorkspaceSelector,
  fetchWorkspace,
} from '../containers/WorkspacePage/WorkspacePage.duck';

interface WorkspaceSwitcherProps {
  onSwitch?: (workspaceId: string) => void;
}

const WorkspaceSwitcher = ({ onSwitch }: WorkspaceSwitcherProps) => {
  const dispatch = useAppDispatch();
  const workspaces = useAppSelector(workspacesSelector);
  const current = useAppSelector(currentWorkspaceSelector);
  const loading = useAppSelector(fetchWorkspacesInProgressSelector);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const workspaceId = e.target.value;
    if (workspaceId) {
      dispatch(fetchWorkspace({ workspaceId }));
      onSwitch?.(workspaceId);
    }
  };

  if (loading) {
    return (
      <span className="text-sm text-muted" aria-live="polite">
        Loading…
      </span>
    );
  }

  if (workspaces.length === 0) {
    return (
      <span className="text-sm text-muted">No workspaces</span>
    );
  }

  return (
    <select
      className="rounded border border-border bg-bg-overlay px-2 py-1 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary"
      value={current?.id ?? ''}
      onChange={handleChange}
      aria-label="Switch workspace"
    >
      {!current && (
        <option value="" disabled>
          Select workspace
        </option>
      )}
      {workspaces.map((ws) => (
        <option key={ws.id} value={ws.id}>
          {ws.name}
        </option>
      ))}
    </select>
  );
};

export default WorkspaceSwitcher;
