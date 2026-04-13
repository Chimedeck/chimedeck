// TopBar — renders the top navigation bar for both mobile and desktop viewports.
// Mobile: shows hamburger toggle + app name + action icons.
// Desktop: shows action icons only (sidebar provides the primary nav).
import { Bars3Icon } from '@heroicons/react/24/outline';
import { ThemeToggle } from '~/common/components/ThemeToggle';
import IconButton from '~/common/components/IconButton';
import NotificationContainer from '~/extensions/Notification/containers/NotificationContainer';
import translations from '~/common/translations/en.json';

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
      <div className="flex h-14 shrink-0 items-center border-b border-border bg-bg-surface px-4 md:hidden">
        <IconButton
          onClick={onOpenDrawer}
          icon={<Bars3Icon className="h-5 w-5" aria-hidden="true" />}
          aria-label={translations['Layout.openSidebarAriaLabel']}
          aria-expanded={drawerOpen}
          aria-controls="mobile-sidebar"
          data-testid="mobile-sidebar-toggle"
          className="mr-3 text-muted hover:bg-bg-overlay hover:text-base"
        />
        <span className="text-base font-bold">{translations['App.name']}</span>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <NotificationContainer />
        </div>
      </div>

      {/* Desktop topbar — actions only (sidebar provides the brand and nav) */}
      <div className="hidden md:flex h-14 shrink-0 items-center justify-end gap-1 border-b border-border bg-bg-surface px-4">
        <ThemeToggle />
        <NotificationContainer />
      </div>
    </>
  );
}
