// Badge that renders a workspace member's role as a styled label.
import type { Role } from '../api';

// [theme-exception] Role badge colours are intentional product semantics; do not replace with design tokens.
const ROLE_STYLES: Record<Role, string> = {
  OWNER: 'bg-purple-100 text-purple-800', // [theme-exception]
  ADMIN: 'bg-blue-100 text-blue-800',     // [theme-exception]
  MEMBER: 'bg-green-100 text-green-800',  // [theme-exception]
  VIEWER: 'bg-gray-100 text-gray-700',    // [theme-exception]
};

const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

interface RoleBadgeProps {
  role: Role;
}

const RoleBadge = ({ role }: RoleBadgeProps) => {
  const style = ROLE_STYLES[role] ?? 'bg-gray-100 text-gray-700';
  const label = ROLE_LABELS[role] ?? role;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}
      data-testid={`role-badge-${role}`}
    >
      {label}
    </span>
  );
};

export default RoleBadge;
