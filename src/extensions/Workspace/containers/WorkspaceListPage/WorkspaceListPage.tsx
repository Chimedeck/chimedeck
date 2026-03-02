// WorkspaceListPage — shows all workspaces the current user belongs to.
import { useState } from 'react';
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
        <p className="text-slate-400">{translations['WorkspaceListPage.loading']}</p>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">
          {translations['WorkspaceListPage.title']}
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          {translations['WorkspaceListPage.newButton']}
        </button>
      </div>

      {workspaces.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="mb-4 text-6xl" aria-hidden="true">🏢</span>
          <h2 className="mb-2 text-lg font-semibold text-slate-200">
            {translations['WorkspaceListPage.emptyTitle']}
          </h2>
          <p className="mb-6 max-w-xs text-sm text-slate-400">
            {translations['WorkspaceListPage.emptyBody']}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
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
              className="cursor-pointer rounded-xl border border-slate-800 bg-slate-900 p-5 transition-colors hover:border-slate-600"
            >
              <span className="mb-3 block text-3xl" aria-hidden="true">🏢</span>
              <h2 className="mb-1 text-base font-semibold text-slate-100">{ws.name}</h2>
              <p className="text-xs text-slate-500">
                {translations['WorkspaceListPage.createdAt']}{' '}
                {new Date(ws.createdAt).toLocaleDateString()}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); handleOpen(ws.id); }}
                className="mt-4 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
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
