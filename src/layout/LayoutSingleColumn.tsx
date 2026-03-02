import type { ReactNode } from 'react';

interface LayoutSingleColumnProps {
  topbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

// Single-column layout shell — topbar + scrollable content + footer
export default function LayoutSingleColumn({
  topbar,
  footer,
  children,
}: LayoutSingleColumnProps) {
  return (
    <div className="flex min-h-screen flex-col">
      {topbar && <header className="sticky top-0 z-40">{topbar}</header>}
      <main className="flex-1">{children}</main>
      {footer && <footer>{footer}</footer>}
    </div>
  );
}
