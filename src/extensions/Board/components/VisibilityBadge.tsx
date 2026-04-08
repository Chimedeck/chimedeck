// VisibilityBadge — small chip indicating board visibility level.
import { GlobeAltIcon, LockClosedIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import type { BoardVisibility } from '../api';

interface Props {
  visibility: BoardVisibility;
}

type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>;

const CONFIG: Record<BoardVisibility, { label: string; className: string; Icon: HeroIcon }> = {
  PRIVATE: {
    label: 'Private',
    className: 'bg-bg-sunken text-base',
    Icon: LockClosedIcon,
  },
  WORKSPACE: {
    label: 'Workspace',
    className: 'bg-bg-sunken text-base',
    Icon: UserGroupIcon,
  },
  PUBLIC: {
    label: 'Public',
    className: 'bg-success/80 text-inverse',
    Icon: GlobeAltIcon,
  },
};

const VisibilityBadge = ({ visibility }: Props) => {
  const { label, className, Icon } = CONFIG[visibility];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      aria-label={`Board visibility: ${label}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {label}
    </span>
  );
};

export default VisibilityBadge;
