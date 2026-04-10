// Sidebar — layout-level collapsible sidebar for all private pages.
// Expanded: w-64 with icons + labels. Collapsed: w-16 icon-only rail with tooltips.
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
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
  CommandLineIcon,
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
import { isPlatformAdmin } from '~/extensions/Auth/utils/isPlatformAdmin';
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
      className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none whitespace-nowrap rounded bg-bg-base px-2 py-1 text-xs font-medium text-base opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow border border-border"
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
                    ? 'bg-bg-sunken text-base'
                    : 'text-muted hover:bg-bg-overlay hover:text-base'
                }`
              : `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-bg-sunken text-base font-medium'
                    : 'text-muted hover:bg-bg-overlay hover:text-base'
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
              ? 'flex w-full items-center justify-center rounded-lg p-2.5 text-muted hover:bg-bg-overlay hover:text-base transition-colors'
              : 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-bg-overlay hover:text-base transition-colors'
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
  // [why] Platform admin check for the global Plugin Registry — separate from workspace admin.
  const isPlatformAdminUser = isPlatformAdmin(user?.email);

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
    <span className="ml-auto rounded bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"> {/* [theme-exception] amber guest badge is intentional brand colour */}
      {layoutTranslations['Sidebar.guestBadge']}
    </span>
  );

  return (
    <>
      {/* Sidebar panel — transitions width between w-64 (expanded) and w-16 (collapsed) */}
      <nav
        className={`flex h-full flex-col border-r border-border bg-bg-base overflow-hidden transition-[width] duration-300 ease-in-out ${
          collapsed ? 'w-16' : 'w-64'
        }`}
        aria-label={layoutTranslations['Layout.sidebarAriaLabel']}
        data-testid="sidebar"
        data-collapsed={collapsed}
      >
        {/* Logo row + toggle button */}
        <div className="flex h-14 shrink-0 items-center border-b border-border">
          {collapsed ? (
            <div className="flex flex-1 items-center justify-center">
              <img
                src="/apple-touch-icon.png"
                alt={layoutTranslations['App.name']}
                className="h-6 w-6 rounded-sm object-contain"
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center gap-2 px-4 overflow-hidden">
              <img
                src="/apple-touch-icon.png"
                alt={layoutTranslations['App.name']}
                className="h-6 w-6 shrink-0 rounded-sm object-contain"
              />
              <span className="text-base font-bold truncate">{layoutTranslations['App.name']}</span>
            </div>
          )}
          {/* Toggle collapse/expand button — desktop only */}
          {!isMobile && (
            <button
              onClick={toggle}
              className="mr-1.5 flex shrink-0 items-center justify-center rounded p-1 text-subtle hover:bg-bg-overlay hover:text-base transition-colors"
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
        <div className="border-b border-border px-2 py-2">
          {collapsed ? (
            // Collapsed: show workspace initial as avatar button with tooltip
            <div className="relative group">
              <button
                onClick={() => setSwitcherOpen((o) => !o)}
                className="flex w-full items-center justify-center rounded-lg p-2 text-muted hover:bg-bg-overlay transition-colors"
                aria-label={translations['WorkspaceSwitcher.label']}
                aria-expanded={switcherOpen}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-xs font-bold text-indigo-700 dark:text-indigo-300"
                  // [theme-exception] indigo workspace avatar is intentional brand colour
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
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium text-base hover:bg-bg-overlay transition-colors"
                aria-expanded={switcherOpen}
                aria-haspopup="listbox"
                aria-label={translations['WorkspaceSwitcher.label']}
              >
                <span className="truncate">
                  {status === 'loading'
                    ? translations['WorkspaceSwitcher.loading']
                    : (activeWorkspace?.name ?? translations['WorkspaceSwitcher.noWorkspaces'])}
                  {isGuest && (
                    <span className="ml-1.5 rounded bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"> {/* [theme-exception] amber guest badge */}
                      guest
                    </span>
                  )}
                </span>
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
              </button>
              {switcherOpen && (
                <ul
                  role="listbox"
                  aria-label={translations['WorkspaceSwitcher.label']}
                  className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-border bg-bg-surface py-1 shadow-xl"
                >
                  {workspaces.map((ws) => (
                    <li key={ws.id} role="option" aria-selected={ws.id === activeWorkspace?.id}>
                      <button
                        onClick={() => handleSwitchWorkspace(ws.id)}
                        className="w-full px-3 py-1.5 text-left text-sm text-base hover:bg-bg-overlay transition-colors"
                      >
                        {ws.name}
                      </button>
                    </li>
                  ))}
                  <li role="separator" className="my-1 border-t border-border" />
                  <li>
                    <button
                      onClick={() => { setSwitcherOpen(false); setShowCreateModal(true); }}
                      className="flex w-full items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-400 hover:bg-bg-overlay transition-colors"
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
                  <kbd className="ml-auto rounded bg-bg-sunken px-1.5 py-0.5 text-xs text-muted">
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
              <NavItem
                to="/developer/mcp"
                icon={<CommandLineIcon className="h-5 w-5" />}
                label={layoutTranslations['Sidebar.mcpDocsLabel']}
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
              {/* Administration section — visible to platform admins only */}
              {isPlatformAdminUser && (
                <>
                  {!collapsed && (
                    <li>
                      <p className="mt-3 mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
                        {layoutTranslations['Sidebar.administrationSection']}
                      </p>
                    </li>
                  )}
                  <NavItem
                    to="/plugins"
                    icon={<PuzzlePieceIcon className="h-5 w-5" />}
                    label={layoutTranslations['Sidebar.pluginsLabel']}
                    collapsed={collapsed}
                    onNavigate={onClose}
                  />
                </>
              )}
            </ul>
          ) : (
            !collapsed && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 w-full rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted hover:border-border-strong hover:text-subtle transition-colors"
              >
                {translations['Sidebar.createFirst']}
              </button>
            )
          )}
        </div>

        {/* User menu */}
        <div className={`border-t border-border py-2 ${collapsed ? 'px-1.5' : 'px-3'}`}>
          <div className="relative">
            {collapsed ? (
              // Collapsed: avatar-only button with tooltip
              <div className="relative group">
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="flex w-full items-center justify-center rounded-lg p-2 text-base hover:bg-bg-overlay transition-colors"
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
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-inverse"
                      // [theme-exception] indigo avatar ring is intentional brand colour
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
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-base hover:bg-bg-overlay transition-colors"
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
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-inverse"
                    // [theme-exception] indigo avatar ring
                    aria-hidden="true"
                  >
                    {userInitial}
                  </span>
                )}
                <span className="flex-1 truncate text-left">{userDisplayName}</span>
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
              </button>
            )}

            {userMenuOpen && (
              <ul
                role="menu"
                // [why] When collapsed the nav is w-16; the menu must escape to the right
                // rather than rendering within the clipped overflow-hidden container.
                className={`absolute ${
                  collapsed ? 'left-full bottom-0 ml-2' : 'bottom-full left-0 mb-1'
                } w-40 rounded-lg border border-border bg-bg-surface py-1 shadow-xl z-50`}
              >
                <li role="none">
                  <NavLink
                    to="/settings/profile"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="block w-full px-3 py-1.5 text-left text-sm text-base hover:bg-bg-overlay transition-colors"
                  >
                    {translations['Sidebar.settings']}
                  </NavLink>
                </li>
                <li role="none">
                  <NavLink
                    to="/settings/api-tokens"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="block w-full px-3 py-1.5 text-left text-sm text-base hover:bg-bg-overlay transition-colors"
                  >
                    {translations['Sidebar.apiTokens']}
                  </NavLink>
                </li>
                <li role="separator" className="my-1 border-t border-border" />
                <li role="none">
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full px-3 py-1.5 text-left text-sm text-base hover:bg-bg-overlay transition-colors"
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
