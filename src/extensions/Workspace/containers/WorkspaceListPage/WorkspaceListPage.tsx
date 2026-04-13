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
import Button from '~/common/components/Button';
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
        <Button
          variant="primary"
          size="md"
          onClick={() => setShowCreateModal(true)}
        >
          {translations['WorkspaceListPage.newButton']}
        </Button>
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
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowCreateModal(true)}
          >
            {translations['WorkspaceListPage.emptyAction']}
          </Button>
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
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleOpen(ws.id); }}
                className="mt-4"
              >
                {translations['WorkspaceListPage.openButton']}
              </Button>
            </div>
          ))}
        </div>
      )}

      <CreateWorkspaceModal open={showCreateModal} onOpenChange={setShowCreateModal} />
    </div>
  );
}
