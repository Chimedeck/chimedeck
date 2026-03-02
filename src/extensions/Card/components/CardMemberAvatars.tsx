// CardMemberAvatars — small avatar stack for assigned members.
import type { CardMember } from '../api';

interface Props {
  members: CardMember[];
  maxVisible?: number;
}

export const CardMemberAvatars = ({ members, maxVisible = 4 }: Props) => {
  const visible = members.slice(0, maxVisible);
  const overflow = members.length - maxVisible;

  return (
    <div className="flex -space-x-1.5" aria-label="Assigned members">
      {visible.map((member) => {
        const initials = (member.display_name ?? member.email)
          .split(' ')
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        return (
          <span
            key={member.id}
            title={member.display_name ?? member.email}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white ring-2 ring-white"
          >
            {initials}
          </span>
        );
      })}
      {overflow > 0 && (
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-[10px] font-bold text-gray-700 ring-2 ring-white"
          title={`${overflow} more`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
};
