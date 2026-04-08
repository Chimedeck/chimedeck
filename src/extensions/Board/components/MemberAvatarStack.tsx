// MemberAvatarStack — clickable avatar row for board members in the header.
// Clicking opens the Board Members Panel via the onOpenMembers callback.
import BoardMemberAvatars from './BoardMemberAvatars';

interface Member {
  id: string;
  display_name: string | null;
  email: string;
  avatar_url?: string | null;
}

interface Props {
  members: Member[];
  /** Called when the avatar stack is clicked to open the members panel. */
  onOpenMembers: () => void;
  max?: number;
}

const MemberAvatarStack = ({ members, onOpenMembers, max = 5 }: Props) => {
  return (
    <button
      type="button"
      onClick={onOpenMembers}
      className="flex items-center rounded px-1 py-0.5 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label={`Board members (${members.length}). Click to manage.`}
      title="Manage board members"
    >
      {members.length > 0 ? (
        <BoardMemberAvatars members={members} max={max} />
      ) : (
        <span className="text-xs text-muted hover:text-subtle transition-colors">
          + Add members
        </span>
      )}
    </button>
  );
};

export default MemberAvatarStack;
