// CardMemberAvatars — interactive avatar stack; clicking opens MemberAvatarPopover.
// Sprint 28: each avatar is a button that triggers the profile popover.
import { memo, useRef, useState } from 'react';
import type { CardMember } from '../api';
import { MemberAvatarPopover } from './MemberAvatarPopover';

interface Props {
  members: CardMember[];
  maxVisible?: number;
  cardId: string;
  currentUserId: string;
  onRemoveMember?: (cardId: string, memberId: string) => Promise<void>;
}

function CardMemberAvatarsComponent({
  members,
  maxVisible = 4,
  cardId,
  currentUserId,
  onRemoveMember,
}: Props) {
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
          // [theme-exception] text-white on indigo-500 avatar background
          <button
            key={member.id}
            ref={(el) => {
              buttonRefs.current[member.id] = el;
            }}
            type="button"
            title={member.name ?? member.email}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white ring-2 ring-bg-surface hover:ring-indigo-400 transition-all cursor-pointer overflow-hidden" // [theme-exception] text-white on indigo-500 avatar background
            onClick={(e) => {
              e.stopPropagation();
              handleAvatarClick(member, e.currentTarget);
            }}
          >
            {member.avatar_url ? (
              <img src={member.avatar_url} alt={member.name ?? member.email} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </button>
        );
      })}
      {overflow > 0 && (
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-bg-overlay text-[10px] font-bold text-muted ring-2 ring-bg-surface"
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
}

export const CardMemberAvatars = memo(
  CardMemberAvatarsComponent,
  (prev, next) => {
    if (prev === next) return true;
    if (prev.cardId !== next.cardId) return false;
    if (prev.currentUserId !== next.currentUserId) return false;
    if (prev.maxVisible !== next.maxVisible) return false;
    if (prev.onRemoveMember !== next.onRemoveMember) return false;
    if (prev.members === next.members) return true;
    if (prev.members.length !== next.members.length) return false;

    for (let i = 0; i < prev.members.length; i += 1) {
      const prevMember = prev.members[i];
      const nextMember = next.members[i];
      if (
        prevMember.id !== nextMember.id
        || prevMember.name !== nextMember.name
        || prevMember.email !== nextMember.email
        || prevMember.avatar_url !== nextMember.avatar_url
      ) {
        return false;
      }
    }
    return true;
  },
);
