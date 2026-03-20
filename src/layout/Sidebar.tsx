// Sidebar — layout-level collapsible sidebar for all private pages.
// Expanded: w-64 with icons + labels. Collapsed: w-16 icon-only rail with tooltips.
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Squares2X2Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  RectangleStackIcon,
  UsersIcon,
  BuildingOfficeIcon,
  PuzzlePieceIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  selectWorkspaces,
  selectActiveWorkspace,
  selectWorkspacesStatus,
  setActiveWorkspace,
} from '~/extensions/Workspace/duck/workspaceDuck';
import { selectIsGuestInActiveWorkspace } from '~/extensions/Workspace/slices/workspaceSlice';
import { selectAuthUser, logoutThunk } from '~/extensions/Auth/duck/authDuck';
import { selectProfile } from '~/extensions/User/containers/ProfilePage/ProfilePage.duck';
import { selectAdminEmailDomains } from '~/slices/featureFlagsSlice';
import { openInviteModal } from '~/extensions/AdminInvite/adminInvite.slice';
import CreateWorkspaceModal from '~/extensions/Workspace/components/CreateWorkspaceModal';
import translations from '~/extensions/Workspace/translations/en.json';
import layoutTranslations from '~/common/translations/en.json';
import { useSidebarState } from '~/layout/hooks/useSidebarState';

// Tooltip that only renders when the sidebar is collapsed.
// Uses group-hover on the parent to keep the tooltip purely CSS-driven.
function CollapseTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none whitespace-nowrap rounded bg-slate-900 dark:bg-slate-700 px-2 py-1 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150"
    >
      {label}
    </span>
  );
}

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  end?: boolean;
  badge?: React.ReactNode;
  'aria-label'?: string;
  onNavigate?: () => void;
}

function NavItem({ to, icon, label, collapsed, end, badge, 'aria-label': ariaLabel, onNavigate }: NavItemProps) {
  return (
    <li>
      <div className="relative group">
        <NavLink
          to={to}
          {...(end ? { end } : {})}
          {...(collapsed ? { 'aria-label': ariaLabel ?? label } : {})}
          onClick={onNavigate}
          className={({ isActive }) =>
            collapsed
              ? `flex items-center justify-center rounded-lg p-2.5 transition-colors ${
                  isActive
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`
              : `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-medium'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`
          }
        >
          <span className="shrink-0">{icon}</span>
          {!collapsed && <span>{label}</span>}
          {!collapsed && badge}
        </NavLink>
        {collapsed && <CollapseTooltip label={label} />}
      </div>
    </li>
  );
}

interface NavButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  badge?: React.ReactNode;
  'aria-label'?: string;
  onNavigate?: () => void;
}

function NavButton({ onClick, icon, label, collapsed, badge, 'aria-label': ariaLabel, onNavigate }: NavButtonProps) {
  const handleClick = () => {
    onClick();
    onNavigate?.();
  };
  return (
    <li>
      <div className="relative group">
        <button
          onClick={handleClick}
          aria-label={collapsed ? (ariaLabel ?? label) : undefined}
          className={
            collapsed
              ? 'flex w-full items-center justify-center rounded-lg p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors'
              : 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors'
          }
        >
          <span className="shrink-0">{icon}</span>
          {!collapsed && <span>{label}</span>}
          {!collapsed && badge}
        </button>
        {collapsed && <CollapseTooltip label={label} />}
      </div>
    </li>
  );
}

interface SidebarProps {
  // When provided, renders in mobile drawer mode: always expanded, no collapse toggle.
  // Calling onClose signals the parent to close the drawer.
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps = {}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { collapsed: desktopCollapsed, toggle } = useSidebarState();
  // In mobile drawer mode always show expanded layout — collapse is a desktop-only feature.
  const isMobile = Boolean(onClose);
  const collapsed = isMobile ? false : desktopCollapsed;

  const workspaces = useAppSelector(selectWorkspaces);
  const activeWorkspace = useAppSelector(selectActiveWorkspace);
  const status = useAppSelector(selectWorkspacesStatus);
  const user = useAppSelector(selectAuthUser);
  const profile = useAppSelector(selectProfile);
  const adminEmailDomains = useAppSelector(selectAdminEmailDomains);
  const isGuest = useAppSelector(selectIsGuestInActiveWorkspace);

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

  const userInitial = (profile?.name ?? user?.name)?.charAt(0).toUpperCase() ?? '?';
  const userDisplayName = profile?.nickname
    ? `@${profile.nickname}`
    : (profile?.name ?? user?.name ?? translations['Sidebar.unknownUser']);

  const guestBadge = (
    <span className="ml-auto rounded bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
      {layoutTranslations['Sidebar.guestBadge']}
    </span>
  );

  return (
    <>
      {/* Sidebar panel — transitions width between w-64 (expanded) and w-16 (collapsed) */}
      <nav
        className={`flex h-full flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 overflow-hidden transition-[width] duration-300 ease-in-out ${
          collapsed ? 'w-16' : 'w-64'
        }`}
        aria-label={layoutTranslations['Layout.sidebarAriaLabel']}
        data-testid="sidebar"
        data-collapsed={collapsed}
      >
        {/* Logo row + toggle button */}
        <div className="flex h-14 shrink-0 items-center border-b border-slate-200 dark:border-slate-800">
          {collapsed ? (
            <div className="flex flex-1 items-center justify-center">
              <Squares2X2Icon className="h-6 w-6 text-indigo-400" aria-hidden="true" />
            </div>
          ) : (
            <div className="flex flex-1 items-center gap-2 px-4 overflow-hidden">
              <Squares2X2Icon className="h-6 w-6 shrink-0 text-indigo-400" aria-hidden="true" />
              <span className="text-base font-bold text-slate-900 dark:text-white truncate">HoriFlow</span>
            </div>
          )}
          {/* Toggle collapse/expand button — desktop only */}
          {!isMobile && (
            <button
              onClick={toggle}
              className="mr-1.5 flex shrink-0 items-center justify-center rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              aria-label={collapsed ? layoutTranslations['Sidebar.expandAriaLabel'] : layoutTranslations['Sidebar.collapseAriaLabel']}
              data-testid="sidebar-toggle"
            >
              {collapsed ? (
                <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {/* Workspace switcher */}
        <div className="border-b border-slate-200 dark:border-slate-800 px-2 py-2">
          {collapsed ? (
            // Collapsed: show workspace initial as avatar button with tooltip
            <div className="relative group">
              <button
                onClick={() => setSwitcherOpen((o) => !o)}
                className="flex w-full items-center justify-center rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label={translations['WorkspaceSwitcher.label']}
                aria-expanded={switcherOpen}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-xs font-bold text-indigo-700 dark:text-indigo-300"
                  aria-hidden="true"
                >
                  {(activeWorkspace?.name ?? '?').charAt(0).toUpperCase()}
                </span>
              </button>
              <CollapseTooltip
                label={
                  status === 'loading'
                    ? translations['WorkspaceSwitcher.loading']
                    : (activeWorkspace?.name ?? translations['WorkspaceSwitcher.noWorkspaces'])
                }
              />
            </div>
          ) : (
            // Expanded: full workspace switcher button
            <div className="relative">
              <button
                onClick={() => setSwitcherOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-expanded={switcherOpen}
                aria-haspopup="listbox"
                aria-label={translations['WorkspaceSwitcher.label']}
              >
                <span className="truncate">
                  {status === 'loading'
                    ? translations['WorkspaceSwitcher.loading']
                    : (activeWorkspace?.name ?? translations['WorkspaceSwitcher.noWorkspaces'])}
                  {isGuest && (
                    <span className="ml-1.5 rounded bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      guest
                    </span>
                  )}
                </span>
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              </button>
              {switcherOpen && (
                <ul
                  role="listbox"
                  aria-label={translations['WorkspaceSwitcher.label']}
                  className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-xl"
                >
                  {workspaces.map((ws) => (
                    <li key={ws.id} role="option" aria-selected={ws.id === activeWorkspace?.id}>
                      <button
                        onClick={() => handleSwitchWorkspace(ws.id)}
                        className="w-full px-3 py-1.5 text-left text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        {ws.name}
                      </button>
                    </li>
                  ))}
                  <li role="separator" className="my-1 border-t border-slate-200 dark:border-slate-700" />
                  <li>
                    <button
                      onClick={() => { setSwitcherOpen(false); setShowCreateModal(true); }}
                      className="flex w-full items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <PlusIcon className="h-4 w-4" aria-hidden="true" />
                      {translations['Sidebar.newWorkspace']}
                    </button>
                  </li>
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Nav links */}
        <div className={`flex-1 overflow-y-auto py-2 ${collapsed ? 'px-1.5' : 'px-3'}`}>
          {/* Search — triggers Cmd+K listener in AppShell */}
          <div className="mb-1">
            <NavButton
              onClick={() =>
                document.dispatchEvent(
                  new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
                )
              }
              icon={<MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />}
              label={layoutTranslations['Sidebar.searchLabel']}
              collapsed={collapsed}
              aria-label={layoutTranslations['Sidebar.searchAriaLabel']}
              onNavigate={onClose}
              badge={
                !collapsed ? (
                  <kbd className="ml-auto rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-slate-500 dark:text-slate-400">
                    ⌘K
                  </kbd>
                ) : undefined
              }
            />
          </div>

          {activeWorkspace ? (
            <ul className="space-y-0.5">
              <NavItem
                to={`/workspaces/${activeWorkspace.id}/boards`}
                icon={<RectangleStackIcon className="h-5 w-5" />}
                label={translations['Sidebar.boards']}
                collapsed={collapsed}
                badge={isGuest ? guestBadge : undefined}
                onNavigate={onClose}
              />
              {/* [why] GUEST users are not allowed to view workspace members (server enforces 403). */}
              {!isGuest && (
                <NavItem
                  to={`/workspace/${activeWorkspace.id}`}
                  icon={<UsersIcon className="h-5 w-5" />}
                  label={translations['Sidebar.members']}
                  collapsed={collapsed}
                  onNavigate={onClose}
                />
              )}
              <NavItem
                to="/workspaces"
                icon={<BuildingOfficeIcon className="h-5 w-5" />}
                label={translations['Sidebar.allWorkspaces']}
                collapsed={collapsed}
                end
                onNavigate={onClose}
              />
              <NavItem
                to="/developer/plugins"
                icon={<PuzzlePieceIcon className="h-5 w-5" />}
                label={layoutTranslations['Sidebar.pluginDocsLabel']}
                collapsed={collapsed}
                onNavigate={onClose}
              />
              {isAdminUser && (
                <NavButton
                  onClick={() => dispatch(openInviteModal())}
                  icon={<UserPlusIcon className="h-5 w-5" />}
                  label={layoutTranslations['Sidebar.inviteExternalUser']}
                  collapsed={collapsed}
                  aria-label={layoutTranslations['Sidebar.inviteExternalUser']}
                  onNavigate={onClose}
                />
              )}
            </ul>
          ) : (
            !collapsed && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 w-full rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {translations['Sidebar.createFirst']}
              </button>
            )
          )}
        </div>

        {/* User menu */}
        <div className={`border-t border-slate-200 dark:border-slate-800 py-2 ${collapsed ? 'px-1.5' : 'px-3'}`}>
          <div className="relative">
            {collapsed ? (
              // Collapsed: avatar-only button with tooltip
              <div className="relative group">
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="flex w-full items-center justify-center rounded-lg p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  aria-label={userDisplayName}
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={layoutTranslations['Common.avatarAlt']}
                      className="h-7 w-7 rounded-full object-cover"
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white"
                      aria-hidden="true"
                    >
                      {userInitial}
                    </span>
                  )}
                </button>
                <CollapseTooltip label={userDisplayName} />
              </div>
            ) : (
              // Expanded: full user button
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={layoutTranslations['Common.avatarAlt']}
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white"
                    aria-hidden="true"
                  >
                    {userInitial}
                  </span>
                )}
                <span className="flex-1 truncate text-left">{userDisplayName}</span>
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              </button>
            )}

            {userMenuOpen && (
              <ul
                role="menu"
                // [why] When collapsed the nav is w-16; the menu must escape to the right
                // rather than rendering within the clipped overflow-hidden container.
                className={`absolute ${
                  collapsed ? 'left-full bottom-0 ml-2' : 'bottom-full left-0 mb-1'
                } w-40 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-xl z-50`}
              >
                <li role="none">
                  <NavLink
                    to="/settings/profile"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="block w-full px-3 py-1.5 text-left text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    {translations['Sidebar.settings']}
                  </NavLink>
                </li>
                <li role="separator" className="my-1 border-t border-slate-200 dark:border-slate-700" />
                <li role="none">
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full px-3 py-1.5 text-left text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
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
