// MemberRow — renders a single board member row with role selector and remove button.
// The remove button is disabled (with tooltip) when this is the last ADMIN.
import { useState } from 'react';
import type { BoardMember, BoardMemberRole } from '../../slices/boardMembersSlice';

const ROLES: BoardMemberRole[] = ['ADMIN', 'MEMBER', 'VIEWER'];

function initials(member: BoardMember): string {
  const name = member.display_name ?? member.email;
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface Props {
  member: BoardMember;
  /** Whether this row's remove button should be disabled (last-admin guard). */
  isLastAdmin: boolean;
  /** Whether the current viewer is an ADMIN/OWNER (controls can-edit). */
  canEdit: boolean;
  onRoleChange: (userId: string, role: BoardMemberRole) => void;
  onRemove: (userId: string) => void;
}

const MemberRow = ({ member, isLastAdmin, canEdit, onRoleChange, onRemove }: Props) => {
  const label = member.display_name ?? member.email;
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarUrl = avatarFailed ? null : member.avatar_url;
  const removeTitle = isLastAdmin
    ? 'Cannot remove the last board admin'
    : `Remove ${label}`;

  return (
    <li className="flex items-center gap-3 py-2">
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-inverse overflow-hidden ${avatarUrl ? 'bg-bg-overlay' : 'bg-indigo-600'}`}
        aria-hidden="true"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={label}
            className="h-full w-full object-cover"
            onError={() => { setAvatarFailed(true); }}
          />
        ) : (
          initials(member)
        )}
      </div>

      {/* Name / email */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-base">{label}</p>
        {member.display_name && (
          <p className="truncate text-xs text-muted">{member.email}</p>
        )}
      </div>

      {/* Role selector — only editable by admins/owners */}
      {canEdit ? (
        <select
          value={member.role}
          onChange={(e) => onRoleChange(member.user_id, e.target.value as BoardMemberRole)}
          className="rounded border border-border bg-bg-overlay px-2 py-1 text-xs text-base focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={`Change role for ${label}`}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-xs text-muted">{member.role.charAt(0) + member.role.slice(1).toLowerCase()}</span>
      )}

      {/* Remove button — disabled for last admin */}
      {canEdit && (
        <button
          type="button"
          disabled={isLastAdmin}
          title={removeTitle}
          onClick={() => !isLastAdmin && onRemove(member.user_id)}
          className={`ml-1 rounded p-1 text-muted transition-colors ${
            isLastAdmin
              ? 'cursor-not-allowed opacity-40'
              : 'hover:bg-bg-overlay hover:text-danger'
          }`}
          aria-label={removeTitle}
        >
          ✕
        </button>
      )}
    </li>
  );
};

export default MemberRow;
