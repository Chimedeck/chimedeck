// AppShell — sidebar + main content area wrapper used by all private pages.
import { useEffect, useState, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import { fetchWorkspacesThunk, selectActiveWorkspaceId } from '~/extensions/Workspace/duck/workspaceDuck';
import { selectAuthToken } from '~/extensions/Auth/duck/authDuck';
import { fetchProfileThunk } from '~/extensions/User/containers/ProfilePage/ProfilePage.duck';
import { fetchFeatureFlagsThunk } from '~/slices/featureFlagsSlice';
import Sidebar from '~/layout/Sidebar';
import TopBar from '~/layout/TopBar';
import CommandPalette from '~/common/components/CommandPalette';
import InviteExternalUserModal from '~/extensions/AdminInvite/InviteExternalUserModal';
import type { SearchResult } from '~/extensions/Search/api';

export default function AppShell() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const workspaceId = useAppSelector(selectActiveWorkspaceId) ?? '';
  const token = useAppSelector(selectAuthToken) ?? '';
  // Ref for the mobile drawer panel — used by the focus trap
  const drawerRef = useRef<HTMLDivElement>(null);

  // Load workspace list, user profile, and client feature flags once when the shell mounts
  useEffect(() => {
    dispatch(fetchWorkspacesThunk());
    dispatch(fetchProfileThunk());
    dispatch(fetchFeatureFlagsThunk());
  }, [dispatch]);

  // Close mobile drawer on route change (e.g. nav link clicked or browser back)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Open search modal on Cmd+K / Ctrl+K
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus trap + Escape close for mobile drawer
  useEffect(() => {
    if (!sidebarOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;

    // Focus first focusable element on open
    const focusableSelectors =
      'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelectors));
    focusableElements[0]?.focus();

    const handleDrawerKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleDrawerKeyDown);
    return () => document.removeEventListener('keydown', handleDrawerKeyDown);
  }, [sidebarOpen]);

  // Navigate when a search result is selected
  const handleSearchSelect = useCallback((result: SearchResult) => {
    if (result.type === 'board') {
      navigate(`/boards/${result.id}`);
    } else {
      // Card: navigate to its board with card modal open
      const boardId = result.boardId;
      if (boardId) {
        navigate(`/boards/${boardId}?card=${result.id}`);
      }
    }
  }, [navigate]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar — always visible on md+ */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay — always rendered to allow CSS transitions */}
      <div
        className="fixed inset-0 z-30 md:hidden"
        aria-hidden={!sidebarOpen}
        style={{ pointerEvents: sidebarOpen ? 'auto' : 'none' }}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setSidebarOpen(false)}
          data-testid="mobile-sidebar-backdrop"
        />
        {/* Drawer panel — slides in from the left */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          id="mobile-sidebar"
          ref={drawerRef}
          className={`relative z-40 flex h-full transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>
      </div>

      {/* Main content — min-w-0 prevents flex children overflowing on narrow viewports */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <TopBar onOpenDrawer={() => setSidebarOpen(true)} drawerOpen={sidebarOpen} />

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Global command palette — triggered by Cmd+K or Ctrl+K */}
      {workspaceId && (
        <CommandPalette
          workspaceId={workspaceId}
          token={token}
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelect={handleSearchSelect}
        />
      )}

      {/* Admin invite modal — rendered globally so it's accessible from anywhere */}
      <InviteExternalUserModal />
    </div>
  );
}
