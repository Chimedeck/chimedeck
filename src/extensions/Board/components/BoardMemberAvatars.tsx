// BoardMemberAvatars — stacked avatar row for board members (max 5 + overflow badge).
interface Member {
  id: string;
  display_name: string | null;
  email: string;
  avatar_url?: string | null;
}

interface Props {
  members: Member[];
  max?: number;
}

const COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-yellow-500',
];

function initials(member: Member): string {
  const name = member.display_name ?? member.email;
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const BoardMemberAvatars = ({ members, max = 5 }: Props) => {
  const visible = members.slice(0, max);
  const overflow = members.length - visible.length;

  return (
    <ul className="flex items-center list-none m-0 p-0" aria-label="Board members">
      {visible.map((member, i) => (
        <li
          key={member.id}
          title={member.display_name ?? member.email}
          className={`relative -ml-2 first:ml-0 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 text-xs font-semibold text-white overflow-hidden ${member.avatar_url ? '' : COLORS[i % COLORS.length]}`}
          style={{ zIndex: visible.length - i }}
        >
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt={member.display_name ?? member.email}
              className="h-full w-full object-cover"
              onError={(e) => {
                // Hide broken image and let the initials text show through the parent bg
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            initials(member)
          )}
        </li>
      ))}
      {overflow > 0 && (
        <li
          className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 bg-gray-400 dark:bg-slate-600 text-xs font-semibold text-white"
          title={`${overflow} more member${overflow > 1 ? 's' : ''}`}
        >
          +{overflow}
        </li>
      )}
    </ul>
  );
};

export default BoardMemberAvatars;
