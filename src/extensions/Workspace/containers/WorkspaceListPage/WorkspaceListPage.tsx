// WorkspaceListPage — shows all workspaces the current user belongs to.
import { useState } from 'react';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  selectWorkspaces,
  selectWorkspacesStatus,
  setActiveWorkspace,
} from '../../duck/workspaceDuck';
import CreateWorkspaceModal from '../../components/CreateWorkspaceModal';
import translations from '../../translations/en.json';

export default function WorkspaceListPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const workspaces = useAppSelector(selectWorkspaces);
  const status = useAppSelector(selectWorkspacesStatus);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleOpen = (workspaceId: string) => {
    dispatch(setActiveWorkspace(workspaceId));
    navigate(`/workspaces/${workspaceId}/boards`);
  };

  if (status === 'loading' && workspaces.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted">{translations['WorkspaceListPage.loading']}</p>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-base">
          {translations['WorkspaceListPage.title']}
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors" // [theme-exception] text-white on primary button
        >
          {translations['WorkspaceListPage.newButton']}
        </button>
      </div>

      {workspaces.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BuildingOfficeIcon className="mb-4 h-16 w-16 text-subtle" aria-hidden="true" />
          <h2 className="mb-2 text-lg font-semibold text-base">
            {translations['WorkspaceListPage.emptyTitle']}
          </h2>
          <p className="mb-6 max-w-xs text-sm text-muted">
            {translations['WorkspaceListPage.emptyBody']}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition-colors" // [theme-exception] text-white on primary button
          >
            {translations['WorkspaceListPage.emptyAction']}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              onClick={() => handleOpen(ws.id)}
              className="cursor-pointer rounded-xl border border-border bg-bg-surface p-5 transition-colors hover:border-slate-400 dark:hover:border-slate-600"
            >
              <BuildingOfficeIcon className="mb-3 h-8 w-8 text-subtle" aria-hidden="true" />
              <h2 className="mb-1 text-base font-semibold text-base">{ws.name}</h2>
              <p className="text-xs text-subtle">
                {translations['WorkspaceListPage.createdAt']}{' '}
                {new Date(ws.createdAt).toLocaleDateString()}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); handleOpen(ws.id); }}
                className="mt-4 rounded-lg bg-bg-overlay px-3 py-1.5 text-xs font-medium text-base hover:bg-bg-sunken dark:hover:bg-slate-700 transition-colors"
              >
                {translations['WorkspaceListPage.openButton']}
              </button>
            </div>
          ))}
        </div>
      )}

      <CreateWorkspaceModal open={showCreateModal} onOpenChange={setShowCreateModal} />
    </div>
  );
}
