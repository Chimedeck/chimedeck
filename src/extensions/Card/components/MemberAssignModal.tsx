// MemberAssignModal — modal for assigning/removing workspace members from a card.
import { XMarkIcon } from '@heroicons/react/24/outline';
import IconButton from '../../../common/components/IconButton';
import Button from '../../../common/components/Button';
import type { CardMember } from '../api';

interface WorkspaceMember {
  id: string;
  email: string;
  name: string | null;
}

interface Props {
  workspaceMembers: WorkspaceMember[];
  assignedMembers: CardMember[];
  onAssign: (userId: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  onClose: () => void;
}

export const MemberAssignModal = ({
  workspaceMembers,
  assignedMembers,
  onAssign,
  onRemove,
  onClose,
}: Props) => {
  const assignedIds = new Set(assignedMembers.map((m) => m.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Assign members"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-80 rounded-lg bg-bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Assign Members</h2>
          <IconButton
            aria-label="Close"
            icon={<XMarkIcon className="h-4 w-4" aria-hidden="true" />}
            onClick={onClose}
          />
        </div>
        <ul className="max-h-64 overflow-y-auto py-2">
          {workspaceMembers.map((member) => {
            const assigned = assignedIds.has(member.id);
            return (
              <li key={member.id} className="flex items-center gap-2 px-4 py-2 hover:bg-bg-overlay">
                <span className="flex-1 text-sm">{member.name ?? member.email}</span>
                {/* [theme-exception] red/blue chip pattern for assigned state */}
                <Button
                  type="button"
                  variant={assigned ? 'danger' : 'primary'}
                  size="sm"
                  onClick={() => assigned ? onRemove(member.id) : onAssign(member.id)}
                >
                  {assigned ? 'Remove' : 'Assign'}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
