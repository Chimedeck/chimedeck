// Sidebar — persistent left navigation for all private pages.
// Renders workspace switcher, nav links, and user menu.
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Squares2X2Icon,
  ChevronDownIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  RectangleStackIcon,
  UsersIcon,
  BuildingOfficeIcon,
  PuzzlePieceIcon,
  UserPlusIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  selectWorkspaces,
  selectActiveWorkspace,
  selectWorkspacesStatus,
  setActiveWorkspace,
} from '../duck/workspaceDuck';
import { selectIsGuestInActiveWorkspace } from '../slices/workspaceSlice';
import { selectAuthUser } from '~/extensions/Auth/duck/authDuck';
import { logoutThunk } from '~/extensions/Auth/duck/authDuck';
import { selectProfile } from '~/extensions/User/containers/ProfilePage/ProfilePage.duck';
import { selectAdminEmailDomains } from '~/slices/featureFlagsSlice';
import { openInviteModal } from '~/extensions/AdminInvite/adminInvite.slice';
import CreateWorkspaceModal from './CreateWorkspaceModal';
import Button from '~/common/components/Button';
import translations from '../translations/en.json';
import commonTranslations from '~/common/translations/en.json';

export default function Sidebar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const workspaces = useAppSelector(selectWorkspaces);
  const activeWorkspace = useAppSelector(selectActiveWorkspace);
  const status = useAppSelector(selectWorkspacesStatus);
  const user = useAppSelector(selectAuthUser);
  const profile = useAppSelector(selectProfile);
  const adminEmailDomains = useAppSelector(selectAdminEmailDomains);
  const isGuest = useAppSelector(selectIsGuestInActiveWorkspace);

  // Check if the current user's email domain is in ADMIN_EMAIL_DOMAINS (client-side evaluation).
  const userEmail = user?.email ?? '';
  const userDomain = userEmail.split('@')[1]?.toLowerCase() ?? '';
  const isAdminUser =
    userDomain.length > 0 &&
    adminEmailDomains
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)
      .includes(userDomain);

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
        className="flex h-full w-64 flex-col border-r border-border bg-bg-surface"
        aria-label="Sidebar"
      >
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <Squares2X2Icon className="h-6 w-6 text-indigo-400" aria-hidden="true" />
          <span className="text-base font-bold text-base">{commonTranslations['App.name']}</span>
        </div>

        {/* Workspace switcher */}
        <div className="border-b border-border px-3 py-3">
          <div className="relative">
            <Button
              variant="ghost"
              onClick={() => setSwitcherOpen((o) => !o)}
              aria-expanded={switcherOpen}
              aria-haspopup="listbox"
              aria-label={translations['WorkspaceSwitcher.label']}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium"
            >
              <span className="truncate">
                {status === 'loading'
                  ? translations['WorkspaceSwitcher.loading']
                  : (activeWorkspace?.name ?? translations['WorkspaceSwitcher.noWorkspaces'])}
                {isGuest && (
                  <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-xs font-medium text-amber-700">
                    guest
                  </span>
                )}
              </span>
              <ChevronDownIcon className="ml-1 h-4 w-4 text-muted shrink-0" aria-hidden="true" />
            </Button>

            {switcherOpen && (
              <ul
                role="listbox"
                aria-label={translations['WorkspaceSwitcher.label']}
                className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border border-border bg-bg-surface py-1 shadow-xl"
              >
                {workspaces.map((ws) => (
                  <li key={ws.id} role="option" aria-selected={ws.id === activeWorkspace?.id}>
                    <Button
                      variant="ghost"
                      onClick={() => handleSwitchWorkspace(ws.id)}
                      className="w-full rounded-none px-3 py-1.5 text-left text-sm font-normal justify-start"
                    >
                      {ws.name}
                    </Button>
                  </li>
                ))}
                <li role="separator" className="my-1 border-t border-border" />
                <li>
                  <Button
                    variant="ghost"
                    onClick={() => { setSwitcherOpen(false); setShowCreateModal(true); }}
                    className="flex w-full items-center gap-1.5 rounded-none px-3 py-1.5 text-sm text-indigo-400 hover:text-indigo-400 font-normal justify-start"
                  >
                    <PlusIcon className="h-4 w-4" aria-hidden="true" />
                    {translations['Sidebar.newWorkspace']}
                  </Button>
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* Nav links */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {/* Search button — triggers Cmd+K listener in AppShell */}
          <Button
            variant="ghost"
            className="mb-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-normal justify-start"
            onClick={() =>
              document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
              )
            }
            aria-label="Search (⌘K)"
          >
            <MagnifyingGlassIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Search</span>
            <kbd className="ml-auto rounded bg-bg-sunken px-1.5 py-0.5 text-xs text-muted">⌘K</kbd>
          </Button>
          {activeWorkspace ? (
            <ul className="space-y-0.5">
              <li>
                <NavLink
                  to={`/workspaces/${activeWorkspace.id}/boards`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-bg-sunken text-base font-medium'
                        : 'text-muted hover:bg-bg-overlay dark:hover:bg-slate-800 hover:text-base'
                    }`
                  }
                >
                  <RectangleStackIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {translations['Sidebar.boards']}
                  {isGuest && (
                    <span className="ml-auto rounded bg-amber-100 px-1 py-0.5 text-xs font-medium text-amber-700">
                      guest
                    </span>
                  )}
                </NavLink>
              </li>
              {/* [why] GUEST users are not allowed to view workspace members (server enforces 403). */}
              {!isGuest && (
              <li>
                <NavLink
                  to={`/workspace/${activeWorkspace.id}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-bg-sunken text-base font-medium'
                        : 'text-muted hover:bg-bg-overlay dark:hover:bg-slate-800 hover:text-base'
                    }`
                  }
                >
                  <UsersIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {translations['Sidebar.members']}
                </NavLink>
              </li>
              )}
              <li>
                <NavLink
                  to="/workspaces"
                  end
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-bg-sunken text-base font-medium'
                        : 'text-muted hover:bg-bg-overlay dark:hover:bg-slate-800 hover:text-base'
                    }`
                  }
                >
                  <BuildingOfficeIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {translations['Sidebar.allWorkspaces']}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/developer/plugins"
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-bg-sunken text-base font-medium'
                        : 'text-muted hover:bg-bg-overlay dark:hover:bg-slate-800 hover:text-base'
                    }`
                  }
                >
                  <PuzzlePieceIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {commonTranslations['Sidebar.pluginDocsLabel']}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/developer/mcp"
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-bg-sunken text-base font-medium'
                        : 'text-muted hover:bg-bg-overlay dark:hover:bg-slate-800 hover:text-base'
                    }`
                  }
                >
                  <CommandLineIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {commonTranslations['Sidebar.mcpDocsLabel']}
                </NavLink>
              </li>
              {/* Invite External User — visible only to admin-domain users */}
              {isAdminUser && (
                <li>
                  <Button
                    variant="ghost"
                    onClick={() => dispatch(openInviteModal())}
                    aria-label="Invite External User"
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-normal justify-start"
                  >
                    <UserPlusIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    Invite External User
                  </Button>
                </li>
              )}
            </ul>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setShowCreateModal(true)}
              className="mt-2 w-full rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-normal text-muted hover:border-slate-400 dark:hover:border-slate-500"
            >
              {translations['Sidebar.createFirst']}
            </Button>
          )}
        </div>

        {/* User menu */}
        <div className="border-t border-border px-3 py-3">
          <div className="relative">
            <Button
              variant="ghost"
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-normal justify-start"
            >
              {/* Avatar — use profile avatar_url if available, else initials */}
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="h-7 w-7 shrink-0 rounded-full object-cover"
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white" // [theme-exception]: avatar on colored bg
                  aria-hidden="true"
                >
                  {(profile?.name ?? user?.name)?.charAt(0).toUpperCase() ?? '?'}
                </span>
              )}
              <span className="flex-1 truncate text-left">
                {profile?.nickname
                  ? `@${profile.nickname}`
                  : (profile?.name ?? user?.name ?? translations['Sidebar.unknownUser'])}
              </span>
              <ChevronDownIcon className="h-4 w-4 text-subtle shrink-0" aria-hidden="true" />
            </Button>

            {userMenuOpen && (
              <ul
                role="menu"
                className="absolute bottom-full left-0 mb-1 w-full rounded-lg border border-border bg-bg-surface py-1 shadow-xl"
              >
                <li role="none">
                  <NavLink
                    to="/settings/profile"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="block w-full px-3 py-1.5 text-left text-sm text-base hover:bg-bg-overlay dark:hover:bg-slate-700 transition-colors"
                  >
                    {translations['Sidebar.settings']}
                  </NavLink>
                </li>
                <li role="separator" className="my-1 border-t border-border" />
                <li role="none">
                  <Button
                    variant="ghost"
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full rounded-none px-3 py-1.5 text-left text-sm font-normal justify-start"
                  >
                    {translations['Sidebar.logout']}
                  </Button>
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
