// TopBar — renders the top navigation bar for both mobile and desktop viewports.
// Mobile: shows hamburger toggle + app name + action icons.
// Desktop: shows action icons only (sidebar provides the primary nav).
import { Bars3Icon } from '@heroicons/react/24/outline';
import { ThemeToggle } from '~/common/components/ThemeToggle';
import NotificationContainer from '~/extensions/Notification/containers/NotificationContainer';

interface TopBarProps {
  /** Called when the mobile hamburger button is clicked. */
  onOpenDrawer: () => void;
  /** Whether the mobile drawer is currently open — drives aria-expanded. */
  drawerOpen: boolean;
}

export default function TopBar({ onOpenDrawer, drawerOpen }: TopBarProps) {
  return (
    <>
      {/* Mobile topbar — hamburger + brand + actions */}
      <div className="flex h-14 shrink-0 items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:hidden">
        <button
          onClick={onOpenDrawer}
          className="mr-3 rounded p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          aria-label="Open sidebar"
          aria-expanded={drawerOpen}
          aria-controls="mobile-sidebar"
          data-testid="mobile-sidebar-toggle"
        >
          <Bars3Icon className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="text-base font-bold text-slate-900 dark:text-white">HoriFlow</span>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <NotificationContainer />
        </div>
      </div>

      {/* Desktop topbar — actions only (sidebar provides the brand and nav) */}
      <div className="hidden md:flex h-14 shrink-0 items-center justify-end gap-1 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4">
        <ThemeToggle />
        <NotificationContainer />
      </div>
    </>
  );
}
