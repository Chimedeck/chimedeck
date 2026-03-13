// BoardMemberAvatars — stacked avatar row for board members (max 5 + overflow badge).
interface Member {
  id: string;
  display_name: string | null;
  email: string;
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
    <div className="flex items-center" role="list" aria-label="Board members">
      {visible.map((member, i) => (
        <div
          key={member.id}
          role="listitem"
          title={member.display_name ?? member.email}
          className={`relative -ml-2 first:ml-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 text-xs font-semibold text-white ${COLORS[i % COLORS.length]}`}
          style={{ zIndex: visible.length - i }}
        >
          {initials(member)}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 bg-gray-400 dark:bg-slate-600 text-xs font-semibold text-white"
          title={`${overflow} more member${overflow > 1 ? 's' : ''}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

export default BoardMemberAvatars;
