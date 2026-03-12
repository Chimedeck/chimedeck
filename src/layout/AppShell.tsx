// AppShell — sidebar + main content area wrapper used by all private pages.
import { useEffect, useState, useCallback } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import { fetchWorkspacesThunk, selectActiveWorkspaceId } from '~/extensions/Workspace/duck/workspaceDuck';
import { selectAuthToken } from '~/extensions/Auth/duck/authDuck';
import { fetchProfileThunk } from '~/extensions/User/containers/ProfilePage/ProfilePage.duck';
import { fetchFeatureFlagsThunk } from '~/slices/featureFlagsSlice';
import Sidebar from '~/extensions/Workspace/components/Sidebar';
import SearchModal from '~/extensions/Search/components/SearchModal';
import NotificationContainer from '~/extensions/Notification/containers/NotificationContainer';
import InviteExternalUserModal from '~/extensions/AdminInvite/InviteExternalUserModal';
import type { SearchResult } from '~/extensions/Search/api';

export default function AppShell() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const workspaceId = useAppSelector(selectActiveWorkspaceId) ?? '';
  const token = useAppSelector(selectAuthToken) ?? '';

  // Load workspace list, user profile, and client feature flags once when the shell mounts
  useEffect(() => {
    dispatch(fetchWorkspacesThunk());
    dispatch(fetchProfileThunk());
    dispatch(fetchFeatureFlagsThunk());
  }, [dispatch]);

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
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Desktop sidebar — always visible on md+ */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-40 flex">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile topbar with hamburger */}
        <div className="flex h-14 shrink-0 items-center border-b border-slate-800 bg-slate-900 px-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="mr-3 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Open sidebar"
          >
            <Bars3Icon className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="text-base font-bold text-white">HoriFlow</span>
          <div className="ml-auto">
            <NotificationContainer />
          </div>
        </div>

        {/* Desktop topbar — notification bell */}
        <div className="hidden md:flex h-12 shrink-0 items-center justify-end border-b border-slate-800 bg-slate-900 px-4">
          <NotificationContainer />
        </div>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Global search modal — triggered by Cmd+K or Ctrl+K */}
      {workspaceId && (
        <SearchModal
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
