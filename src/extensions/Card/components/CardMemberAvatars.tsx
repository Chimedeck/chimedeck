// CardMemberAvatars — interactive avatar stack; clicking opens MemberAvatarPopover.
// Sprint 28: each avatar is a button that triggers the profile popover.
import { useRef, useState } from 'react';
import type { CardMember } from '../api';
import { MemberAvatarPopover } from './MemberAvatarPopover';

interface Props {
  members: CardMember[];
  maxVisible?: number;
  cardId: string;
  currentUserId: string;
  onRemoveMember?: (cardId: string, memberId: string) => Promise<void>;
}

export const CardMemberAvatars = ({
  members,
  maxVisible = 4,
  cardId,
  currentUserId,
  onRemoveMember,
}: Props) => {
  const visible = members.slice(0, maxVisible);
  const overflow = members.length - maxVisible;

  const [activeMember, setActiveMember] = useState<CardMember | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const anchorRef = useRef<HTMLButtonElement | null>(null);

  const handleAvatarClick = (member: CardMember, btn: HTMLButtonElement) => {
    anchorRef.current = btn;
    setActiveMember(member);
  };

  return (
    <div className="flex -space-x-1.5" aria-label="Assigned members">
      {visible.map((member) => {
        const initials = (member.name ?? member.email)
          .split(' ')
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        return (
          <button
            key={member.id}
            ref={(el) => {
              buttonRefs.current[member.id] = el;
            }}
            type="button"
            title={member.name ?? member.email}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white ring-2 ring-slate-800 hover:ring-indigo-400 transition-all cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleAvatarClick(member, e.currentTarget);
            }}
          >
            {initials}
          </button>
        );
      })}
      {overflow > 0 && (
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-600 text-[10px] font-bold text-white ring-2 ring-slate-800"
          title={`${overflow} more`}
        >
          +{overflow}
        </span>
      )}

      {activeMember && (
        <MemberAvatarPopover
          member={activeMember}
          isSelf={activeMember.id === currentUserId}
          {...(onRemoveMember
            ? {
                onRemove: async () => {
                  await onRemoveMember(cardId, activeMember.id);
                  setActiveMember(null);
                },
              }
            : {})}
          onClose={() => setActiveMember(null)}
          anchorRef={anchorRef as React.RefObject<HTMLElement>}
        />
      )}
    </div>
  );
};
