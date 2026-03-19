// MemberRow — renders a single board member row with role selector and remove button.
// The remove button is disabled (with tooltip) when this is the last ADMIN.
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
  const removeTitle = isLastAdmin
    ? 'Cannot remove the last board admin'
    : `Remove ${label}`;

  return (
    <li className="flex items-center gap-3 py-2">
      {/* Avatar */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white"
        aria-hidden="true"
      >
        {initials(member)}
      </div>

      {/* Name / email */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-100">{label}</p>
        {member.display_name && (
          <p className="truncate text-xs text-slate-400">{member.email}</p>
        )}
      </div>

      {/* Role selector — only editable by admins/owners */}
      {canEdit ? (
        <select
          value={member.role}
          onChange={(e) => onRoleChange(member.user_id, e.target.value as BoardMemberRole)}
          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label={`Change role for ${label}`}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-xs text-slate-400">{member.role.charAt(0) + member.role.slice(1).toLowerCase()}</span>
      )}

      {/* Remove button — disabled for last admin */}
      {canEdit && (
        <button
          type="button"
          disabled={isLastAdmin}
          title={removeTitle}
          onClick={() => !isLastAdmin && onRemove(member.user_id)}
          className={`ml-1 rounded p-1 text-slate-400 transition-colors ${
            isLastAdmin
              ? 'cursor-not-allowed opacity-40'
              : 'hover:bg-slate-700 hover:text-red-400'
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
