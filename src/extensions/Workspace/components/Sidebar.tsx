// Sidebar — persistent left navigation for all private pages.
// Renders workspace switcher, nav links, and user menu.
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  selectWorkspaces,
  selectActiveWorkspace,
  selectWorkspacesStatus,
  setActiveWorkspace,
} from '../duck/workspaceDuck';
import { selectAuthUser } from '~/extensions/Auth/duck/authDuck';
import { logoutThunk } from '~/extensions/Auth/duck/authDuck';
import CreateWorkspaceModal from './CreateWorkspaceModal';
import translations from '../translations/en.json';

export default function Sidebar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const workspaces = useAppSelector(selectWorkspaces);
  const activeWorkspace = useAppSelector(selectActiveWorkspace);
  const status = useAppSelector(selectWorkspacesStatus);
  const user = useAppSelector(selectAuthUser);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleSwitchWorkspace = (workspaceId: string) => {
    dispatch(setActiveWorkspace(workspaceId));
    navigate(`/workspaces/${workspaceId}/boards`);
    setSwitcherOpen(false);
  };

  const handleLogout = async () => {
    await dispatch(logoutThunk());
    navigate('/login', { replace: true });
  };

  return (
    <>
      <nav
        className="flex h-full w-64 flex-col border-r border-slate-800 bg-slate-900"
        aria-label="Sidebar"
      >
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-800 px-4">
          <span className="text-xl" aria-hidden="true">🟦</span>
          <span className="text-base font-bold text-white">Kanban</span>
        </div>

        {/* Workspace switcher */}
        <div className="border-b border-slate-800 px-3 py-3">
          <div className="relative">
            <button
              onClick={() => setSwitcherOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
              aria-expanded={switcherOpen}
              aria-haspopup="listbox"
              aria-label={translations['WorkspaceSwitcher.label']}
            >
              <span className="truncate">
                {status === 'loading'
                  ? translations['WorkspaceSwitcher.loading']
                  : (activeWorkspace?.name ?? translations['WorkspaceSwitcher.noWorkspaces'])}
              </span>
              <span className="ml-1 text-slate-400" aria-hidden="true">▾</span>
            </button>

            {switcherOpen && (
              <ul
                role="listbox"
                aria-label={translations['WorkspaceSwitcher.label']}
                className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl"
              >
                {workspaces.map((ws) => (
                  <li key={ws.id} role="option" aria-selected={ws.id === activeWorkspace?.id}>
                    <button
                      onClick={() => handleSwitchWorkspace(ws.id)}
                      className="w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                    >
                      {ws.name}
                    </button>
                  </li>
                ))}
                <li role="separator" className="my-1 border-t border-slate-700" />
                <li>
                  <button
                    onClick={() => { setSwitcherOpen(false); setShowCreateModal(true); }}
                    className="flex w-full items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-400 hover:bg-slate-700 transition-colors"
                  >
                    <span aria-hidden="true">+</span>
                    {translations['Sidebar.newWorkspace']}
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* Nav links */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {activeWorkspace ? (
            <ul className="space-y-0.5">
              <li>
                <NavLink
                  to={`/workspaces/${activeWorkspace.id}/boards`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-slate-800 text-white font-medium'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <span aria-hidden="true">📋</span>
                  {translations['Sidebar.boards']}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to={`/workspace/${activeWorkspace.id}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-slate-800 text-white font-medium'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <span aria-hidden="true">👥</span>
                  {translations['Sidebar.members']}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/workspaces"
                  end
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-slate-800 text-white font-medium'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <span aria-hidden="true">🏢</span>
                  {translations['Sidebar.allWorkspaces']}
                </NavLink>
              </li>
            </ul>
          ) : (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-2 w-full rounded-lg border border-dashed border-slate-700 px-3 py-2 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-colors"
            >
              {translations['Sidebar.createFirst']}
            </button>
          )}
        </div>

        {/* User menu */}
        <div className="border-t border-slate-800 px-3 py-3">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
            >
              {/* Avatar */}
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white"
                aria-hidden="true"
              >
                {user?.name?.charAt(0).toUpperCase() ?? '?'}
              </span>
              <span className="flex-1 truncate text-left">{user?.name ?? translations['Sidebar.unknownUser']}</span>
              <span className="text-slate-500" aria-hidden="true">▾</span>
            </button>

            {userMenuOpen && (
              <ul
                role="menu"
                className="absolute bottom-full left-0 mb-1 w-full rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl"
              >
                <li role="none">
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    {translations['Sidebar.logout']}
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      </nav>

      <CreateWorkspaceModal open={showCreateModal} onOpenChange={setShowCreateModal} />
    </>
  );
}
