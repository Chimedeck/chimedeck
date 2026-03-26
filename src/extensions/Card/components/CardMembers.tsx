// CardMembers — assigned member avatars + assign/unassign popover.
import { useState } from 'react';
import type { CardMember } from '../api';
import { CardMemberAvatars } from './CardMemberAvatars';

interface BoardMember {
  id: string;
  email: string;
  name: string | null;
}

interface Props {
  members: CardMember[];
  boardMembers: BoardMember[];
  cardId: string;
  currentUserId: string;
  onAssign: (userId: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  disabled?: boolean;
}

const CardMembers = ({ members, boardMembers, cardId, currentUserId, onAssign, onRemove, disabled }: Props) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const assignedIds = new Set(members.map((m) => m.id));

  const handleToggle = async (member: BoardMember) => {
    if (assignedIds.has(member.id)) {
      await onRemove(member.id);
    } else {
      await onAssign(member.id);
    }
  };

  return (
    <div>
      {members.length > 0 && (
        <div className="mb-2">
          <CardMemberAvatars
            members={members}
            maxVisible={5}
            cardId={cardId}
            currentUserId={currentUserId}
            onRemoveMember={async (_, memberId) => onRemove(memberId)}
          />
        </div>
      )}

      {!disabled && (
        <div className="relative">
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
            onClick={() => setPickerOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={pickerOpen}
          >
            + Assign
          </button>

          {pickerOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setPickerOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute left-0 top-6 z-20 w-56 rounded-xl bg-white border border-gray-200 shadow-2xl p-2 space-y-1">
                {boardMembers.length === 0 && (
                  <p className="text-xs text-gray-400 px-2 py-1">No board members</p>
                )}
                {boardMembers.map((member) => {
                  const assigned = assignedIds.has(member.id);
                  const name = member.name ?? member.email;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => handleToggle(member)}
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white flex-shrink-0">
                        {name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="flex-1 truncate">{name}</span>
                      {assigned && <span className="text-emerald-400">✓</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CardMembers;
