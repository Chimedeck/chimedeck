// MemberAssignModal — modal for assigning/removing workspace members from a card.
import type { CardMember } from '../api';

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
      <div className="w-80 rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Assign Members</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <ul className="max-h-64 overflow-y-auto py-2">
          {workspaceMembers.map((member) => {
            const assigned = assignedIds.has(member.id);
            return (
              <li key={member.id} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50">
                <span className="flex-1 text-sm">{member.display_name ?? member.email}</span>
                <button
                  type="button"
                  className={`rounded px-2 py-0.5 text-xs ${assigned ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                  onClick={() => assigned ? onRemove(member.id) : onAssign(member.id)}
                >
                  {assigned ? 'Remove' : 'Assign'}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
