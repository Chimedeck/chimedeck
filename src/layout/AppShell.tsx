// AppShell — sidebar + main content area wrapper used by all private pages.
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { fetchWorkspacesThunk } from '~/extensions/Workspace/duck/workspaceDuck';
import Sidebar from '~/extensions/Workspace/components/Sidebar';

export default function AppShell() {
  const dispatch = useAppDispatch();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load workspace list once when the shell mounts
  useEffect(() => {
    dispatch(fetchWorkspacesThunk());
  }, [dispatch]);

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
            ☰
          </button>
          <span className="text-base font-bold text-white">Kanban</span>
        </div>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
