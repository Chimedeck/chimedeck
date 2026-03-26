// MembersSection — displays assigned member avatars and triggers the assign modal.
import { useState } from 'react';
import { useSelector } from 'react-redux';
import type { CardMember } from '../../../api';
import { CardMemberAvatars } from '../../../components/CardMemberAvatars';
import { MemberAssignModal } from '../../../components/MemberAssignModal';
import { selectCurrentUser } from '~/slices/authSlice';

interface WorkspaceMember {
  id: string;
  email: string;
  name: string | null;
}

interface Props {
  cardId: string;
  workspaceMembers: WorkspaceMember[];
  assignedMembers: CardMember[];
  onAssign: (userId: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  disabled?: boolean;
}

export const MembersSection = ({
  cardId,
  workspaceMembers,
  assignedMembers,
  onAssign,
  onRemove,
  disabled,
}: Props) => {
  const [showModal, setShowModal] = useState(false);
  const currentUser = useSelector(selectCurrentUser);

  const handleRemoveMember = async (_cId: string, memberId: string) => {
    await onRemove(memberId);
  };

  return (
    <section aria-label="Members">
      <h3 className="mb-1 text-sm font-semibold text-base">Members</h3>
      <div className="flex items-center gap-2">
        {assignedMembers.length === 0 ? (
          <span className="text-xs text-subtle">No members assigned</span>
        ) : (
          <CardMemberAvatars
            members={assignedMembers}
            cardId={cardId}
            currentUserId={currentUser?.id ?? ''}
            onRemoveMember={handleRemoveMember}
          />
        )}
        {!disabled && (
          <button
            type="button"
            className="rounded border border-border bg-bg-surface px-2 py-0.5 text-xs text-muted hover:bg-bg-overlay"
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
