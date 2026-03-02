// MembersSection — displays assigned member avatars and triggers the assign modal.
import { useState } from 'react';
import type { CardMember } from '../../api';
import { CardMemberAvatars } from '../../components/CardMemberAvatars';
import { MemberAssignModal } from '../../components/MemberAssignModal';

interface WorkspaceMember {
  id: string;
  email: string;
  display_name: string | null;
}

interface Props {
  workspaceMembers: WorkspaceMember[];
  assignedMembers: CardMember[];
  onAssign: (userId: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  disabled?: boolean;
}

export const MembersSection = ({
  workspaceMembers,
  assignedMembers,
  onAssign,
  onRemove,
  disabled,
}: Props) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <section aria-label="Members">
      <h3 className="mb-1 text-sm font-semibold text-gray-700">Members</h3>
      <div className="flex items-center gap-2">
        {assignedMembers.length === 0 ? (
          <span className="text-xs text-gray-400">No members assigned</span>
        ) : (
          <CardMemberAvatars members={assignedMembers} />
        )}
        {!disabled && (
          <button
            type="button"
            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
            onClick={() => setShowModal(true)}
          >
            Assign
          </button>
        )}
      </div>
      {showModal && (
        <MemberAssignModal
          workspaceMembers={workspaceMembers}
          assignedMembers={assignedMembers}
          onAssign={onAssign}
          onRemove={onRemove}
          onClose={() => setShowModal(false)}
        />
      )}
    </section>
  );
};
