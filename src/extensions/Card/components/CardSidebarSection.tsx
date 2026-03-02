// CardSidebarSection — reusable labelled section wrapper for modal sidebar.
import type { ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
}

const CardSidebarSection = ({ title, children }: Props) => (
  <div>
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
      {title}
    </p>
    {children}
  </div>
);

export default CardSidebarSection;
